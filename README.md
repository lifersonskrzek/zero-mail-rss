# Zero-Mail RSS 📡

> Replace newsletters with RSS feeds directly in Chrome. No email, no noise.

Zero-Mail RSS is a free, open-source Chrome extension that monitors RSS feeds in the background and sends native notifications when new articles are published — without any external server, account, or subscription service.

---

## ✨ Features

- **Automatic RSS detection** — visits any website and detects RSS/Atom feeds automatically
- **1-click subscription** — subscribe to a feed directly from the browser toolbar
- **Background monitoring** — checks all subscribed feeds every 60 minutes silently
- **Native notifications** — Windows and macOS native alerts for new articles
- **Built-in dashboard** — read article headlines organized by source, with unread counters
- **Free translation** — translate article titles to any language via Google Translate (opt-in)
- **Notification control** — mute/unmute notifications with one click (🔔/🔕)
- **Subscription manager** — add and remove feeds at any time

---

## 🔒 Privacy first

- **No server** — zero data leaves your device to our systems
- **No account** — no sign-up, no login, no tracking
- **No ads** — ever
- **Local storage only** — all data is stored in `chrome.storage.local` on your device
- **Translation is opt-in** — only article titles are sent to Google Translate, and only when you enable it

→ Read the full explanation in [WHY_PERMISSIONS.md](./WHY_PERMISSIONS.md)  
→ Read the Privacy Policy in [PRIVACY.md](./PRIVACY.md)

---

## 🚀 Installation

### From the Chrome Web Store
*(Coming soon)*

### Manual installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **"Load unpacked"** and select the `zero-mail` folder
5. Pin the extension to the toolbar

---

## 📁 Project structure

```
zero-mail/
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service Worker: alarms, fetch, notifications
├── content.js             # Injected in every tab: detects RSS feeds
├── popup/
│   ├── popup.html         # Dashboard UI
│   └── popup.js           # Dashboard logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── dev/
│   └── gerar-icones.html  # Icon generator (development only)
├── README.md
├── WHY_PERMISSIONS.md     # Plain-language permission explanations
└── PRIVACY.md             # Privacy policy
```

---

## 🛠️ How it works

```
[User visits a site]
      │
      ▼
content.js scans <head> for <link rel="alternate" type="application/rss+xml">
      │
      ├── Not found → nothing happens
      └── Found → badge appears on toolbar icon
                      │
                      ▼
            [User clicks the icon]
            Popup shows feed info + "Subscribe" button
                      │
                      ▼
            Feed saved to chrome.storage.local

[background.js — every 60 min via chrome.alarms]
      │
      ▼
Silent fetch on all subscribed feeds
      │
      ├── No new articles → nothing
      └── New article → native OS notification
                              │
                              ├── "Open article" → opens in new tab
                              └── "Dismiss" → article stays in dashboard
```

---

## 🌐 Permissions explained

| Permission | Why it's needed |
|---|---|
| `storage` | Save subscriptions, articles and preferences locally |
| `alarms` | Check feeds every 60 minutes in the background |
| `notifications` | Show native OS alerts for new articles |
| `activeTab` | Read the current tab URL to detect RSS feeds |
| `tabs` | Detect tab closures and open article links |
| `host_permissions: <all_urls>` | Fetch RSS feeds from any domain the user subscribes to |

→ Full explanation: [WHY_PERMISSIONS.md](./WHY_PERMISSIONS.md)

---

## 📋 RSS feeds to test

| Site | Feed URL |
|---|---|
| CSS-Tricks | `https://css-tricks.com/feed/` |
| Smashing Magazine | `https://www.smashingmagazine.com/feed/` |
| Dev.to | `https://dev.to/feed` |
| Tecnoblog | `https://tecnoblog.net/feed/` |
| Hacker News | `https://hnrss.org/frontpage` |

---

## 📄 License

MIT License — see [LICENSE](./LICENSE) for details.

---

## 🤝 Contributing

Issues and pull requests are welcome.  
If you find a bug or have a feature request, please open an issue.

---

*Built with JavaScript, zero dependencies, zero tracking.*
