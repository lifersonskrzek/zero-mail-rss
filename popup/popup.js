// popup.js — Fase 2 (corrigido)
// Correções: globo removido, detecção de feeds reintegrada.

// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────

const SOURCE_COLORS = [
  '#E87722', '#3182CE', '#38A169', '#9F7AEA',
  '#E53E3E', '#D69E2E', '#00B5D8', '#ED64A6'
];

const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

// ─────────────────────────────────────────────
// ESTADO GLOBAL DA SESSÃO
// ─────────────────────────────────────────────

const S = {
  feeds:       {},
  articles:    {},
  source:      'all',
  tab:         'articles',
  translateOn: false,
  lang:        'pt',
  cache:       {},
  fetching:    false,
  detected:    null,   // feed detectado na aba atual (se houver)
  silenced:    false   // notificações silenciadas
};

// ─────────────────────────────────────────────
// INICIALIZAÇÃO
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const d = await chrome.storage.local.get([
    'subscribedFeeds', 'articles', 'translateEnabled',
    'translateLang', 'lastFetched', 'detectedFeeds', 'notifSilenced',
    'translateNoticeSeen'
  ]);

  S.feeds       = d.subscribedFeeds  || {};
  S.articles    = d.articles         || {};
  S.translateOn = d.translateEnabled || false;
  S.lang        = d.translateLang    || 'pt';
  S.silenced    = d.notifSilenced    || false;

  // Verifica se há feed detectado na aba atual ainda não assinado
  const detectedFeeds = d.detectedFeeds || {};
  const detected      = tab ? detectedFeeds[tab.id] : null;

  if (detected) {
    if (detected.ignored && !S.feeds[detected.domain]) {
      // Domínio foi ignorado antes — oferece reativação
      showReactivationBanner(detected, tab);
    } else if (!detected.ignored && !S.feeds[detected.domain]) {
      // Feed novo — fluxo normal
      S.detected = detected;
      showDetectionBanner(detected, tab);
    }
  }

  // Eventos estáticos (existem sempre no DOM)
  document.getElementById('tab-articles').addEventListener('click', () => {
    S.tab = 'articles'; render();
  });
  document.getElementById('tab-manage').addEventListener('click', () => {
    S.tab = 'manage'; render();
  });
  document.getElementById('translate-toggle').addEventListener('click', toggleTranslate);
  document.getElementById('lang-select').addEventListener('change', e => changeLang(e.target.value));
  document.getElementById('notif-btn').addEventListener('click', toggleSilence);

  render();

  // Busca artigos se necessário
  const totalFeeds    = Object.keys(S.feeds).length;
  const totalArticles = Object.values(S.articles).flat().length;
  const stale         = !d.lastFetched || (Date.now() - d.lastFetched > CACHE_TTL);

  if (totalFeeds > 0 && (!totalArticles || stale)) {
    if (!totalArticles) { S.fetching = true; renderContent(); }
    await fetchAll();
    S.fetching = false;
    render();
  }
});

// ─────────────────────────────────────────────
// BANNER DE DETECÇÃO
// ─────────────────────────────────────────────

function showDetectionBanner(detected, tab) {
  const feed   = detected.feeds[0];
  const banner = document.getElementById('detection-banner');

  document.getElementById('detect-name').textContent = feed.title || detected.domain;
  document.getElementById('detect-url').textContent  = feed.url;
  banner.style.display = 'block';

  // Ajusta altura do main-content para compensar o banner
  const bannerH = banner.offsetHeight || 110;
  document.getElementById('main-content').style.height = `${300 - bannerH}px`;

  document.getElementById('btn-assinar').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({
      type: 'SUBSCRIBE_FEED',
      feed: { ...feed, domain: detected.domain }
    });

    // Atualiza estado local imediatamente
    S.feeds[detected.domain] = {
      url:          feed.url,
      title:        feed.title || detected.domain,
      domain:       detected.domain,
      subscribedAt: Date.now(),
      lastChecked:  null,
      articles:     []
    };
    S.detected = null;

    banner.style.display = 'none';
    document.getElementById('main-content').style.height = '300px';

    showToast('✓ Feed assinado com sucesso!');

    // Busca artigos do novo feed imediatamente
    S.fetching = true;
    renderContent();
    await fetchAll();
    S.fetching = false;
    render();
  });

  document.getElementById('btn-ignorar').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({
      type: 'IGNORE_DOMAIN',
      domain: detected.domain
    });
    S.detected = null;
    banner.style.display = 'none';
    document.getElementById('main-content').style.height = '300px';
    showToast('Domínio ignorado');
  });
}

// ─────────────────────────────────────────────
// BANNER DE REATIVAÇÃO (domínio previamente ignorado)
// ─────────────────────────────────────────────

function showReactivationBanner(detected, tab) {
  const feed   = detected.feeds[0];
  const banner = document.getElementById('detection-banner');

  document.getElementById('detect-name').textContent = feed.title || detected.domain;
  document.getElementById('detect-url').textContent  = feed.url;

  // Ajusta visual do banner para estado "ignorado"
  banner.style.background    = '#1a1500';
  banner.style.borderColor   = '#2a2200';

  const dotEl = banner.querySelector('.dot-pulse');
  if (dotEl) dotEl.style.background = '#888';

  const labelEl = banner.querySelector('.detect-label span');
  if (labelEl) {
    labelEl.textContent = 'Domínio ignorado anteriormente';
    labelEl.style.color = '#aaa';
  }

  const btnAssinar = document.getElementById('btn-assinar');
  const btnIgnorar = document.getElementById('btn-ignorar');
  btnAssinar.textContent  = '↩ Reativar e assinar';
  btnIgnorar.style.display = 'none'; // não faz sentido ignorar de novo

  banner.style.display = 'block';
  const bannerH = banner.offsetHeight || 110;
  document.getElementById('main-content').style.height = `${300 - bannerH}px`;

  btnAssinar.onclick = async () => {
    // Remove domínio dos ignorados
    const s = await chrome.storage.local.get('ignoredDomains');
    const ignoredDomains = (s.ignoredDomains || []).filter(d => d !== detected.domain);
    await chrome.storage.local.set({ ignoredDomains });

    // Assina o feed
    await chrome.runtime.sendMessage({
      type: 'SUBSCRIBE_FEED',
      feed: { ...feed, domain: detected.domain }
    });

    S.feeds[detected.domain] = {
      url: feed.url, title: feed.title || detected.domain,
      domain: detected.domain, subscribedAt: Date.now(),
      lastChecked: null, articles: []
    };

    banner.style.display = 'none';
    document.getElementById('main-content').style.height = '300px';
    showToast('✓ Feed reativado e assinado!');
    setTimeout(init, 700);
  };
}

// ─────────────────────────────────────────────
// RENDER PRINCIPAL
// ─────────────────────────────────────────────

function render() {
  renderHeader();
  renderContent();
  renderFooter();
}

function renderHeader() {
  const toggle = document.getElementById('translate-toggle');
  const track  = document.getElementById('translate-track');
  const thumb  = document.getElementById('translate-thumb');
  const label  = document.getElementById('translate-label');
  const sel    = document.getElementById('lang-select');
  const sino   = document.getElementById('notif-btn');

  // Atualiza estado do sino
  if (S.silenced) {
    sino.classList.add('silenced');
    sino.title = 'Notificações silenciadas — clique para reativar';
  } else {
    sino.classList.remove('silenced');
    sino.title = 'Notificações ativas — clique para silenciar';
  }

  // Estado do toggle de tradução
  if (S.translateOn) {
    toggle.classList.add('on');
    track.classList.add('on');
    thumb.classList.add('on');
    label.textContent = 'Traduzido';
    sel.value         = S.lang;
  } else {
    toggle.classList.remove('on');
    track.classList.remove('on');
    thumb.classList.remove('on');
    label.textContent = 'Traduzir';
  }

  // Esconde TUDO de tradução na aba Gerenciar (roda por último para sobrescrever acima)
  if (S.tab === 'manage') {
    toggle.style.display = 'none';
    sel.style.display    = 'none';
  } else {
    toggle.style.display = '';
    sel.style.display    = S.translateOn ? 'block' : 'none';
  }
}

function renderContent() {
  document.getElementById('tab-articles').classList.toggle('active', S.tab === 'articles');
  document.getElementById('tab-manage').classList.toggle('active', S.tab === 'manage');

  if (S.tab === 'articles') renderArticles();
  else renderManage();
}

function renderFooter() {
  const feedCount    = Object.keys(S.feeds).length;
  const articleCount = Object.values(S.articles).flat().length;
  const el           = document.getElementById('footer-text');

  if (feedCount === 0) {
    el.textContent = 'Nenhuma assinatura ainda';
  } else {
    el.textContent = `${feedCount} ${feedCount === 1 ? 'feed' : 'feeds'} · ${articleCount} artigos`;
  }
}

// ─────────────────────────────────────────────
// ABA: ARTIGOS
// ─────────────────────────────────────────────

function renderArticles() {
  const main    = document.getElementById('main-content');
  const domains = Object.keys(S.feeds);

  if (domains.length === 0) {
    main.innerHTML = emptyHTML(
      'Nenhuma assinatura ainda',
      'Visite um site com RSS e clique em<br>"Assinar agora" no banner acima.'
    );
    return;
  }

  if (S.fetching && Object.values(S.articles).flat().length === 0) {
    main.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Buscando artigos…</p>
      </div>`;
    return;
  }

  // Monta artigos com metadados de fonte
  let all = [];
  domains.forEach((domain, i) => {
    const color = SOURCE_COLORS[i % SOURCE_COLORS.length];
    const arts  = (S.articles[domain] || []).map(a => ({
      ...a, domain, color,
      feedTitle: S.feeds[domain]?.title || domain
    }));
    all = all.concat(arts);
  });

  const filtered = S.source === 'all'
    ? all
    : all.filter(a => a.domain === S.source);

  filtered.sort((a, b) => b.date - a.date);

  const unread      = {};
  domains.forEach(d => { unread[d] = (S.articles[d] || []).filter(a => !a.read).length; });
  const totalUnread = Object.values(unread).reduce((s, n) => s + n, 0);

  const sourcesHTML = `
    <div class="source-label">FONTES</div>
    <div class="source-item ${S.source === 'all' ? 'active' : ''}" data-source="all">
      <span class="source-name">Tudo</span>
      ${totalUnread > 0 ? `<span class="unread-badge">${totalUnread}</span>` : ''}
    </div>
    ${domains.map((domain, i) => {
      const color = SOURCE_COLORS[i % SOURCE_COLORS.length];
      const nr    = unread[domain] || 0;
      return `
        <div class="source-item ${S.source === domain ? 'active' : ''}" data-source="${esc(domain)}">
          <div class="source-dot" style="background:${color}"></div>
          <span class="source-name">${esc(S.feeds[domain]?.title || domain)}</span>
          ${nr > 0 ? `<span class="unread-badge">${nr}</span>` : ''}
        </div>`;
    }).join('')}
  `;

  const articlesHTML = filtered.length === 0
    ? `<div class="empty-articles">
        <p>Nenhum artigo ainda.</p>
        <button class="btn-refresh" id="btn-refresh">↺ Atualizar</button>
       </div>`
    : filtered.map(a => `
        <div class="article-row ${a.read ? 'read' : ''}"
             data-url="${esc(a.url)}" data-domain="${esc(a.domain)}">
          <div class="article-meta">
            <div class="article-dot" style="background:${a.color}"></div>
            <span class="article-src" style="color:${a.color}">${esc(a.feedTitle)}</span>
            <span class="article-time">${timeAgo(a.date)}</span>
          </div>
          <div class="article-title" data-original="${esc(a.title)}">${esc(a.title)}</div>
        </div>`).join('');

  main.innerHTML = `
    <div class="dashboard">
      <div class="sources-col">${sourcesHTML}</div>
      <div class="articles-col">${articlesHTML}</div>
    </div>`;

  // Eventos: filtro de fonte
  main.querySelectorAll('.source-item').forEach(el => {
    el.addEventListener('click', () => {
      S.source = el.dataset.source;
      renderArticles();
      if (S.translateOn) applyTranslations();
    });
  });

  // Eventos: clique em artigo
  main.querySelectorAll('.article-row').forEach(el => {
    el.addEventListener('click', () => {
      const url    = el.dataset.url;
      const domain = el.dataset.domain;
      markRead(domain, url);
      el.classList.add('read');
      chrome.tabs.create({ url });
    });
  });

  const btnR = document.getElementById('btn-refresh');
  if (btnR) {
    btnR.addEventListener('click', async () => {
      S.fetching = true; renderContent();
      await fetchAll();
      S.fetching = false; render();
    });
  }

  if (S.translateOn) applyTranslations();
}

// ─────────────────────────────────────────────
// ABA: GERENCIAR
// ─────────────────────────────────────────────

function renderManage() {
  const main    = document.getElementById('main-content');
  const domains = Object.keys(S.feeds);

  if (domains.length === 0) {
    main.innerHTML = emptyHTML('Nenhuma assinatura ainda', 'Visite um site com RSS para assinar.');
    return;
  }

  main.innerHTML = `
    <div class="manage-list">
      ${domains.map((domain, i) => {
        const color = SOURCE_COLORS[i % SOURCE_COLORS.length];
        return `
          <div class="manage-row" id="mrow-${esc(domain)}">
            <div class="manage-dot" style="background:${color}"></div>
            <div class="manage-info">
              <div class="manage-name">${esc(S.feeds[domain]?.title || domain)}</div>
              <div class="manage-url">${esc(S.feeds[domain]?.url || '')}</div>
            </div>
            <button class="btn-remove" data-domain="${esc(domain)}">✕ remover</button>
          </div>`;
      }).join('')}
    </div>
    <div class="manage-hint">Passe o mouse sobre uma linha para remover.</div>`;

  main.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeFeed(btn.dataset.domain);
    });
  });
}

// ─────────────────────────────────────────────
// FETCH RSS
// ─────────────────────────────────────────────

async function fetchAll() {
  const domains = Object.keys(S.feeds);
  if (!domains.length) return;

  await Promise.allSettled(domains.map(async domain => {
    const feed = S.feeds[domain];
    try {
      const res   = await fetch(feed.url, { cache: 'no-store' });
      const xml   = await res.text();
      const fresh = parseFeed(xml, feed.url);

      const existing    = S.articles[domain] || [];
      const existingIds = new Set(existing.map(a => a.id));
      const merged      = [...existing];

      for (const a of fresh) {
        if (!existingIds.has(a.id)) merged.unshift(a);
      }

      S.articles[domain] = merged.slice(0, 50);
    } catch (err) {
      console.warn(`Zero-Mail: erro ao buscar ${domain}:`, err.message);
    }
  }));

  await chrome.storage.local.set({ articles: S.articles, lastFetched: Date.now() });
}

// ─────────────────────────────────────────────
// AÇÕES
// ─────────────────────────────────────────────

async function markRead(domain, url) {
  const arts = S.articles[domain] || [];
  const idx  = arts.findIndex(a => a.id === url || a.url === url);
  if (idx !== -1) {
    arts[idx].read = true;
    S.articles[domain] = arts;
    await chrome.storage.local.set({ articles: S.articles });
  }
}

async function removeFeed(domain) {
  const row = document.getElementById(`mrow-${domain}`);
  if (row) {
    row.style.transition = 'opacity 0.25s, max-height 0.3s, padding 0.3s';
    row.style.overflow   = 'hidden';
    row.style.maxHeight  = row.offsetHeight + 'px';
    requestAnimationFrame(() => {
      row.style.opacity   = '0';
      row.style.maxHeight = '0';
      row.style.padding   = '0';
    });
  }
  await new Promise(r => setTimeout(r, 320));

  delete S.feeds[domain];
  delete S.articles[domain];

  await chrome.storage.local.set({ subscribedFeeds: S.feeds, articles: S.articles });

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      if (new URL(tab.url).hostname === domain) {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }
    } catch {}
  }

  render();
}

// ─────────────────────────────────────────────
// TRADUÇÃO
// ─────────────────────────────────────────────

async function toggleSilence() {
  S.silenced = !S.silenced;
  await chrome.storage.local.set({ notifSilenced: S.silenced });
  renderHeader();
  showToast(S.silenced ? '🔕 Notificações silenciadas' : '🔔 Notificações ativas');
}

async function toggleTranslate() {
  S.translateOn = !S.translateOn;
  await chrome.storage.local.set({ translateEnabled: S.translateOn });
  renderHeader();

  if (S.translateOn) {
    // Exibe aviso de privacidade APENAS na primeira vez que o usuário ativa a tradução
    const st = await chrome.storage.local.get('translateNoticeSeen');
    if (!st.translateNoticeSeen) {
      await chrome.storage.local.set({ translateNoticeSeen: true });
      showTranslateNotice();
    }
    applyTranslations();
  } else {
    // Esconde aviso se estiver visível
    document.querySelectorAll('.article-title').forEach(el => {
      el.textContent = el.dataset.original || el.textContent;
    });
  }
}


async function changeLang(lang) {
  S.lang  = lang;
  S.cache = {};
  await chrome.storage.local.set({ translateLang: lang });
  applyTranslations();
}

async function applyTranslations() {
  const els = Array.from(document.querySelectorAll('.article-title'));
  await Promise.all(els.map(async el => {
    const original = el.dataset.original;
    if (!original) return;
    if (S.cache[original]) { el.textContent = S.cache[original]; return; }
    el.style.opacity = '0.4';
    try {
      const t          = await translateText(original, S.lang);
      S.cache[original] = t;
      el.textContent   = t;
    } catch { el.textContent = original; }
    el.style.opacity = '1';
  }));
}

async function translateText(text, lang) {
  const url  = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`;
  const res  = await fetch(url);
  const data = await res.json();
  return data[0].map(i => i[0]).join('');
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────

function showTranslateNotice() {
  // Mostra o aviso temporariamente no rodapé, com o mesmo estilo da linha "X feeds · X artigos"
  const footerEl = document.getElementById('footer-text');
  if (!footerEl) return;
  const textoOriginal = footerEl.textContent;
  footerEl.textContent = '⚠️ Títulos enviados ao Google Translate para tradução.';
  setTimeout(() => {
    footerEl.textContent = textoOriginal;
  }, 8000);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  const h = Math.floor(d / 3600000);
  const dy = Math.floor(d / 86400000);
  if (m  <  1) return 'agora';
  if (m  < 60) return `${m}min`;
  if (h  < 24) return `${h}h`;
  return `${dy}d`;
}

function emptyHTML(title, sub) {
  return `
    <div class="empty-state">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="#444">
        <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36
                 M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44
                 m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
      </svg>
      <p class="empty-title">${title}</p>
      <p class="empty-sub">${sub}</p>
    </div>`;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
