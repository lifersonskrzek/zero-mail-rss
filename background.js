// background.js — Fase 3 (completo)
// ════════════════════════════════════════════
// Fase 1: detecção de RSS, subscribe, ignore, badge
// Fase 3: chrome.alarms, fetch silencioso, notificações nativas
// ════════════════════════════════════════════


// ═══════════════════════════════════════════════
// FASE 3 — CONFIGURAÇÃO DO ALARME
// ═══════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
  createAlarmIfNeeded();
  console.log('Zero-Mail RSS: extensão instalada/atualizada.');
});

chrome.runtime.onStartup.addListener(() => {
  createAlarmIfNeeded();
});

function createAlarmIfNeeded() {
  chrome.alarms.get('rss-check', alarm => {
    if (!alarm) {
      chrome.alarms.create('rss-check', {
        delayInMinutes:  1,   // primeira verificação 1 min após iniciar
        periodInMinutes: 60   // depois a cada 60 minutos
      });
      console.log('Zero-Mail RSS: alarme criado (intervalo: 60 min).');
    }
  });
}

// ─────────────────────────────────────────────
// ALARME → DISPARA VERIFICAÇÃO
// ─────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'rss-check') {
    console.log(`Zero-Mail RSS: verificação iniciada — ${new Date().toLocaleTimeString()}`);
    await checkForNewArticles();
  }
});


// ═══════════════════════════════════════════════
// FASE 3 — VERIFICAÇÃO DE NOVOS ARTIGOS
// ═══════════════════════════════════════════════

async function checkForNewArticles() {
  const storage = await chrome.storage.local.get([
    'subscribedFeeds', 'articles', 'seenArticleIds'
  ]);

  const subscribedFeeds = storage.subscribedFeeds || {};
  const articles        = storage.articles        || {};
  const seenSet         = new Set(storage.seenArticleIds || []);

  const domains = Object.keys(subscribedFeeds);
  if (domains.length === 0) {
    console.log('Zero-Mail RSS: nenhum feed assinado.');
    return;
  }

  const toNotify = []; // artigos novos a notificar

  await Promise.allSettled(domains.map(async domain => {
    const feed = subscribedFeeds[domain];
    try {
      const res   = await fetch(feed.url, { cache: 'no-store' });
      const xml   = await res.text();
      const fresh = parseRssBackground(xml, feed.url);

      const existing    = articles[domain] || [];
      const existingIds = new Set(existing.map(a => a.id));

      for (const article of fresh) {
        if (!existingIds.has(article.id)) {
          // Artigo inédito — adiciona à lista
          existing.unshift(article);
          existingIds.add(article.id);

          // Notifica apenas se ainda não foi notificado antes
          if (!seenSet.has(article.id)) {
            toNotify.push({
              feedTitle: feed.title || domain,
              domain,
              article
            });
          }
        }
      }

      // Mantém máximo de 50 artigos por feed
      articles[domain] = existing.slice(0, 50);

    } catch (err) {
      console.warn(`Zero-Mail RSS: falha ao verificar ${domain}:`, err.message);
    }
  }));

  // Salva artigos atualizados independente de ter novidade
  await chrome.storage.local.set({ articles, lastFetched: Date.now() });

  if (toNotify.length === 0) {
    console.log('Zero-Mail RSS: nenhum artigo novo encontrado.');
    return;
  }

  // Verifica se notificações estão silenciadas pelo usuário
  const { notifSilenced } = await chrome.storage.local.get('notifSilenced');
  if (notifSilenced) {
    console.log(`Zero-Mail RSS: ${toNotify.length} artigo(s) novo(s) — notificações silenciadas.`);
    return;
  }

  console.log(`Zero-Mail RSS: ${toNotify.length} artigo(s) novo(s). Notificando…`);

  // Dispara no máximo 3 notificações por ciclo para não fazer spam
  const limite   = toNotify.slice(0, 3);
  const notifMap = (await chrome.storage.local.get('notifMap')).notifMap || {};

  for (const { feedTitle, domain, article } of limite) {
    const notifId = `zm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    chrome.notifications.create(notifId, {
      type:    'basic',
      iconUrl: chrome.runtime.getURL('icons/icon48.png'),
      title:   feedTitle,
      message: article.title,
      buttons: [
        { title: 'Abrir artigo' },
        { title: 'Dispensar'   }
      ]
    });

    // Armazena notifId → dados do artigo (usado nos handlers de clique)
    notifMap[notifId] = {
      url:    article.url,
      domain: domain,
      id:     article.id
    };

    seenSet.add(article.id);
  }

  // Limpa o mapa de notificações (máx. 100 entradas)
  const mapKeys = Object.keys(notifMap);
  if (mapKeys.length > 100) {
    mapKeys.slice(0, mapKeys.length - 100).forEach(k => delete notifMap[k]);
  }

  // Limpa seenArticleIds (máx. 500 entradas)
  const seenArray = [...seenSet].slice(-500);

  await chrome.storage.local.set({
    notifMap,
    seenArticleIds: seenArray
  });
}


// ═══════════════════════════════════════════════
// FASE 3 — HANDLERS DE NOTIFICAÇÃO
// ═══════════════════════════════════════════════

// Clique no corpo da notificação → abre o artigo
chrome.notifications.onClicked.addListener(async (notifId) => {
  if (!notifId.startsWith('zm_')) return;
  await abrirArtigoDeNotif(notifId);
  chrome.notifications.clear(notifId);
});

// Clique nos botões da notificação
chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  if (!notifId.startsWith('zm_')) return;

  if (buttonIndex === 0) {
    // "Abrir artigo"
    await abrirArtigoDeNotif(notifId);
  } else if (buttonIndex === 1) {
    // "Dispensar" — marca como visto, permanece no dashboard
    await dispensarArtigoDeNotif(notifId);
  }

  chrome.notifications.clear(notifId);
});

async function abrirArtigoDeNotif(notifId) {
  const storage  = await chrome.storage.local.get(['notifMap', 'articles']);
  const notifMap = storage.notifMap || {};
  const data     = notifMap[notifId];
  if (!data) return;

  // Marca artigo como lido e visto no storage
  const articles   = storage.articles || {};
  const domainArts = articles[data.domain] || [];
  const idx = domainArts.findIndex(a => a.id === data.id || a.url === data.url);
  if (idx !== -1) {
    domainArts[idx].read = true;
    domainArts[idx].seen = true;
    articles[data.domain] = domainArts;
    await chrome.storage.local.set({ articles });
  }

  chrome.tabs.create({ url: data.url });
}

async function dispensarArtigoDeNotif(notifId) {
  const storage  = await chrome.storage.local.get(['notifMap', 'articles']);
  const notifMap = storage.notifMap || {};
  const data     = notifMap[notifId];
  if (!data) return;

  // Marca apenas como "visto" — título fica no dashboard, não notifica de novo
  const articles   = storage.articles || {};
  const domainArts = articles[data.domain] || [];
  const idx = domainArts.findIndex(a => a.id === data.id || a.url === data.url);
  if (idx !== -1) {
    domainArts[idx].seen = true;
    articles[data.domain] = domainArts;
    await chrome.storage.local.set({ articles });
  }
}


// ═══════════════════════════════════════════════
// FASE 3 — PARSER RSS/ATOM (compatível com Service Worker)
// Usa regex/string em vez de DOMParser (indisponível no SW)
// ═══════════════════════════════════════════════

function parseRssBackground(xmlString, feedUrl) {
  // Remove namespaces que atrapalham o parsing
  const xml = xmlString.replace(/<\?xml[^>]*\?>/g, '').trim();

  const isAtom = /<feed[\s>]/i.test(xml);
  return isAtom
    ? parseAtomBg(xml, feedUrl)
    : parseRssBg(xml, feedUrl);
}

// ── RSS 2.0 ───────────────────────────────────

function parseRssBg(xml, feedUrl) {
  const items = extractBlocks(xml, 'item');
  return items.slice(0, 20).map(block => {
    const title   = extractTag(block, 'title');
    const link    = extractTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate');
    return buildBgArticle(title, link || feedUrl, pubDate);
  }).filter(Boolean);
}

// ── Atom ──────────────────────────────────────

function parseAtomBg(xml, feedUrl) {
  const entries = extractBlocks(xml, 'entry');
  return entries.slice(0, 20).map(block => {
    const title = extractTag(block, 'title');
    // Tenta <link href="..."> primeiro, depois conteúdo de <link>
    const linkHref = (block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i) || [])[1];
    const link     = linkHref || extractTag(block, 'link') || feedUrl;
    const date     = extractTag(block, 'updated') || extractTag(block, 'published');
    return buildBgArticle(title, link, date);
  }).filter(Boolean);
}

// ── Helpers ───────────────────────────────────

// Extrai todos os blocos <tag>...</tag> de um XML
function extractBlocks(xml, tag) {
  const blocks = [];
  const openTag  = new RegExp(`<${tag}[\\s>]`, 'gi');
  const closeTag = `</${tag}>`;
  let match;
  while ((match = openTag.exec(xml)) !== null) {
    const start = match.index;
    const end   = xml.indexOf(closeTag, start);
    if (end === -1) break;
    blocks.push(xml.slice(start, end + closeTag.length));
  }
  return blocks;
}

// Extrai o conteúdo de uma tag simples (ignora CDATA e atributos)
function extractTag(block, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m  = block.match(re);
  if (!m) return '';
  // Remove CDATA wrapper se existir
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function buildBgArticle(title, url, dateStr) {
  if (!title || !url) return null;
  const ts = dateStr ? new Date(dateStr).getTime() : Date.now();
  return {
    id:      url.trim(),
    title:   title.trim(),
    url:     url.trim(),
    date:    isNaN(ts) ? Date.now() : ts,
    summary: '',
    read:    false,
    seen:    false
  };
}


// ═══════════════════════════════════════════════
// FASE 1 — DETECÇÃO E ASSINATURA (mantido intacto)
// ═══════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RSS_FOUND')         handleRssFound(message, sender);
  if (message.type === 'SUBSCRIBE_FEED')    handleSubscribe(message.feed);
  if (message.type === 'IGNORE_DOMAIN')     handleIgnoreDomain(message.domain);
  if (message.type === 'GET_DETECTED_FEED') {
    getDetectedFeedForTab(message.tabId, sendResponse);
    return true;
  }
});

async function handleRssFound(message, sender) {
  const { feeds, domain } = message;
  const tabId = sender.tab?.id;
  if (!tabId) return;

  const storage = await chrome.storage.local.get([
    'subscribedFeeds', 'ignoredDomains', 'detectedFeeds'
  ]);

  const subscribedFeeds = storage.subscribedFeeds || {};
  const ignoredDomains  = storage.ignoredDomains  || [];
  const detectedFeeds   = storage.detectedFeeds   || {};

  // Domínio ignorado? Salva com ignored:true (sem badge) para permitir reativação
  if (ignoredDomains.includes(domain)) {
    detectedFeeds[tabId] = { feeds, domain, timestamp: Date.now(), ignored: true };
    await chrome.storage.local.set({ detectedFeeds });
    return;
  }

  // Já assinado? Para.
  if (subscribedFeeds[domain]) return;

  // Feed novo! Salva e exibe badge.
  detectedFeeds[tabId] = { feeds, domain, timestamp: Date.now() };
  await chrome.storage.local.set({ detectedFeeds });

  chrome.action.setBadgeText({ text: '1', tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#E53E3E', tabId });
}

async function handleSubscribe(feed) {
  const storage = await chrome.storage.local.get(['subscribedFeeds', 'detectedFeeds']);
  const subscribedFeeds = storage.subscribedFeeds || {};
  const detectedFeeds   = storage.detectedFeeds   || {};

  subscribedFeeds[feed.domain] = {
    url:          feed.url,
    title:        feed.title,
    domain:       feed.domain,
    subscribedAt: Date.now(),
    lastChecked:  null,
    articles:     []
  };

  for (const tabId of Object.keys(detectedFeeds)) {
    if (detectedFeeds[tabId]?.domain === feed.domain) delete detectedFeeds[tabId];
  }

  await chrome.storage.local.set({ subscribedFeeds, detectedFeeds });
  await clearBadgeForDomain(feed.domain);
}

async function handleIgnoreDomain(domain) {
  const storage = await chrome.storage.local.get(['ignoredDomains', 'detectedFeeds']);
  const ignoredDomains = storage.ignoredDomains || [];
  const detectedFeeds  = storage.detectedFeeds  || {};

  if (!ignoredDomains.includes(domain)) ignoredDomains.push(domain);

  for (const tabId of Object.keys(detectedFeeds)) {
    if (detectedFeeds[tabId]?.domain === domain) delete detectedFeeds[tabId];
  }

  await chrome.storage.local.set({ ignoredDomains, detectedFeeds });
  await clearBadgeForDomain(domain);
}

async function getDetectedFeedForTab(tabId, sendResponse) {
  const storage = await chrome.storage.local.get('detectedFeeds');
  sendResponse((storage.detectedFeeds || {})[tabId] || null);
}

async function clearBadgeForDomain(domain) {
  // Usa a URL real da aba em vez de detectedFeeds (que já foi limpo antes desta chamada)
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      if (new URL(tab.url).hostname === domain) {
        chrome.action.setBadgeText({ text: '', tabId: tab.id });
      }
    } catch {}
  }
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const storage       = await chrome.storage.local.get('detectedFeeds');
  const detectedFeeds = storage.detectedFeeds || {};
  if (detectedFeeds[tabId]) {
    delete detectedFeeds[tabId];
    await chrome.storage.local.set({ detectedFeeds });
  }
});
