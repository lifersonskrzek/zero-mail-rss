// rss-parser.js
// Parseia feeds RSS 2.0 e Atom a partir de uma string XML.
// Retorna array de objetos de artigo padronizados.

function parseFeed(xmlString, feedUrl) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xmlString, 'text/xml');

  // Erro de parse (XML inválido)
  if (doc.querySelector('parsererror')) return [];

  // Detecta tipo: Atom tem tag <feed>, RSS tem <rss> ou <channel>
  const isAtom = !!doc.querySelector('feed');
  return isAtom ? parseAtom(doc, feedUrl) : parseRss(doc, feedUrl);
}

// ── RSS 2.0 ──────────────────────────────────

function parseRss(doc, feedUrl) {
  const items = doc.querySelectorAll('item');
  return Array.from(items).slice(0, 30).map(item => {
    const title   = getText(item, 'title');
    const link    = getText(item, 'link') || getText(item, 'guid');
    const pubDate = getText(item, 'pubDate');
    const desc    = getText(item, 'description');
    return buildArticle(title, link || feedUrl, pubDate, desc);
  }).filter(Boolean);
}

// ── Atom ─────────────────────────────────────

function parseAtom(doc, feedUrl) {
  const entries = doc.querySelectorAll('entry');
  return Array.from(entries).slice(0, 30).map(entry => {
    const title   = getText(entry, 'title');
    const linkEl  = entry.querySelector('link[rel="alternate"], link:not([rel="self"])');
    const link    = linkEl?.getAttribute('href') || feedUrl;
    const date    = getText(entry, 'updated') || getText(entry, 'published');
    const summary = getText(entry, 'summary') || getText(entry, 'content');
    return buildArticle(title, link, date, summary);
  }).filter(Boolean);
}

// ── Helpers ───────────────────────────────────

function buildArticle(title, url, dateStr, summary) {
  if (!title || !url) return null;
  const ts = dateStr ? new Date(dateStr).getTime() : Date.now();
  return {
    id:      url.trim(),
    title:   title.trim(),
    url:     url.trim(),
    date:    isNaN(ts) ? Date.now() : ts,
    summary: stripHtml(summary || '').slice(0, 220),
    read:    false,
    seen:    false
  };
}

function getText(el, tag) {
  return el.querySelector(tag)?.textContent?.trim() || '';
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
