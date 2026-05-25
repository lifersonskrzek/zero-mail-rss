// content.js
// Roda em cada aba visitada. Varre o <head> por feeds RSS ou Atom.
// Se encontrar, envia mensagem ao background.js.

(function () {

  // Evita rodar mais de uma vez na mesma aba
  if (window.__zeroMailChecked) return;
  window.__zeroMailChecked = true;

  // Roda apenas no frame principal (ignora iframes)
  if (window !== window.top) return;

  // Busca por tags <link rel="alternate"> com tipo RSS ou Atom
  const feedLinks = document.querySelectorAll(
    'link[rel="alternate"][type="application/rss+xml"],' +
    'link[rel="alternate"][type="application/atom+xml"]'
  );

  if (feedLinks.length === 0) return;

  // Monta array com os feeds encontrados
  const feeds = Array.from(feedLinks).map(link => ({
    url:    link.href,
    title:  link.title || document.title || window.location.hostname,
    domain: window.location.hostname
  }));

  // Envia para o background.js tratar
  chrome.runtime.sendMessage({
    type:      'RSS_FOUND',
    feeds:     feeds,
    domain:    window.location.hostname,
    pageTitle: document.title
  });

})();
