# Por que o Zero-Mail RSS precisa dessas permissões?

Esta extensão foi construída com o princípio de pedir o mínimo necessário.
Abaixo, a explicação honesta de cada permissão declarada no `manifest.json`.

---

## `storage`
**Para que serve:** salvar suas assinaturas de feeds RSS, artigos lidos e preferências
(idioma de tradução, notificações silenciadas) diretamente no seu dispositivo.

**O que NÃO faz:** nenhum dado é enviado a servidores externos. Tudo fica
armazenado localmente no seu perfil do Chrome via `chrome.storage.local`.

---

## `alarms`
**Para que serve:** verificar automaticamente se há artigos novos nos feeds que
você assinou, a cada 60 minutos, mesmo com o popup fechado.

**O que NÃO faz:** não acessa nenhum dado do sistema fora desse intervalo
de verificação de feeds.

---

## `notifications`
**Para que serve:** exibir notificações nativas do sistema operacional quando
um novo artigo é publicado em um feed assinado.

**O que NÃO faz:** notificações são 100% opcionais — você pode silenciá-las
a qualquer momento pelo botão 🔔 no popup. Nenhuma notificação é enviada
para servidores externos.

---

## `activeTab`
**Para que serve:** ler o endereço da aba ativa para saber em qual site você
está navegando e verificar se há um feed RSS disponível naquela página.

**O que NÃO faz:** não lê o conteúdo das páginas que você visita, não
captura texto digitado, não acessa histórico de navegação.

---

## `tabs`
**Para que serve:** detectar quando uma aba é fechada (para limpar dados
temporários de feeds detectados) e abrir links de artigos em novas abas.

**O que NÃO faz:** não rastreia quais sites você visita, não lê o conteúdo
das abas abertas.

---

## `host_permissions: <all_urls>`
**Para que serve:** esta é a permissão mais ampla e merece explicação detalhada.

O Zero-Mail RSS precisa de acesso a todos os URLs por dois motivos:

1. **Detectar feeds RSS em qualquer site** — o `content.js` verifica se a
   página atual tem uma tag `<link rel="alternate" type="application/rss+xml">`
   no cabeçalho HTML. Isso precisa funcionar em qualquer site que o usuário
   visitar, não apenas em uma lista pré-definida.

2. **Buscar os feeds assinados** — o `background.js` faz requisições HTTP
   diretamente para as URLs dos feeds RSS que o usuário assinou (ex:
   `https://css-tricks.com/feed/`). Como feeds podem estar em qualquer domínio,
   a permissão precisa ser ampla.

**O que NÃO faz:** a extensão não lê, não modifica, não captura nem transmite
o conteúdo das páginas que você visita. O único dado coletado de cada página
é a presença ou ausência de uma tag RSS no cabeçalho HTML.

---

## O que esta extensão NUNCA faz

- ❌ Não possui servidor próprio — nenhum dado sai do seu dispositivo para nossos sistemas
- ❌ Não coleta dados pessoais, senhas, histórico ou cookies
- ❌ Não injeta scripts nas páginas que você visita
- ❌ Não rastreia sua navegação
- ❌ Não exibe anúncios
- ❌ Não vende dados para terceiros

## Sobre a tradução (Google Translate)

Quando você ativa o toggle **Traduzir** no popup, os títulos dos artigos
visíveis são enviados ao endpoint público do Google Translate para tradução.

- Os dados enviados são apenas os **títulos dos artigos** — textos públicos
  já disponíveis na internet
- Nenhum dado pessoal é enviado
- A tradução é **opt-in** — desabilitada por padrão, ativada apenas se você
  clicar no toggle

---

*Última atualização: maio de 2026*
*Código-fonte disponível em: [github.com/seu-usuario/zero-mail-rss]*
