# Privacy Policy — Zero-Mail RSS

*Last updated: May 2026*

---

## Overview

Zero-Mail RSS is a Chrome extension that monitors RSS feeds and sends notifications for new articles. This policy explains what data is handled, how, and why.

**Short version:** we don't collect anything. There is no server. Your data never leaves your device.

---

## Data we collect

**We collect nothing.** Zero-Mail RSS has no backend server, no analytics, no telemetry, and no data collection of any kind.

---

## Data stored locally on your device

The extension stores the following data in `chrome.storage.local`, which means it stays on your computer and is accessible only by this extension:

| Data | Purpose |
|---|---|
| Feed URLs and titles | To know which RSS feeds to monitor |
| Article headlines and links | To display in the dashboard and avoid duplicate notifications |
| Read/seen status of articles | To show which articles you have already read |
| Translation preference (language) | To remember your language choice |
| Notification mute preference | To remember if you silenced notifications |
| Ignored domains | To remember which sites you chose not to subscribe to |

This data is never sent to any server operated by us or any third party (except as described in the Translation section below).

---

## Data sent to third parties

### RSS feed servers
When you subscribe to an RSS feed, the extension fetches that feed URL directly from the publisher's server every 60 minutes. This is a standard HTTP request, identical to what a browser would make when you visit the site. The feed server may log your IP address, as is standard for any web request.

### Google Translate (opt-in only)
If you activate the **Translate** toggle in the dashboard, the **titles of visible articles** are sent to Google Translate's public API endpoint for translation. This feature is:
- **Disabled by default** — you must explicitly enable it
- **Easily reversible** — click the toggle again to disable it
- **Limited in scope** — only article titles are sent, not article content, URLs, or any personal data

Google's privacy policy applies to this data: https://policies.google.com/privacy

---

## Permissions and why we need them

| Permission | Reason |
|---|---|
| `storage` | Store subscriptions and preferences locally on your device |
| `alarms` | Schedule background checks every 60 minutes |
| `notifications` | Show native OS notifications for new articles |
| `activeTab` | Detect RSS feeds on the page you are currently visiting |
| `tabs` | Open article links and clean up data when tabs are closed |
| `host_permissions: <all_urls>` | Fetch RSS feeds from any domain you subscribe to |

For a plain-language explanation of each permission, see [WHY_PERMISSIONS.md](./WHY_PERMISSIONS.md).

---

## Data retention

All locally stored data remains until you:
- Remove a feed subscription (deletes articles for that feed)
- Uninstall the extension (deletes all stored data)
- Manually clear extension data via Chrome settings

---

## Children's privacy

This extension does not knowingly collect any information from children under 13.

---

## Changes to this policy

If this policy changes in a meaningful way, the change will be reflected in the version history of this file on GitHub. We will not reduce your privacy protections without explicit notice.

---

## Contact

If you have questions about this privacy policy, please open an issue on the GitHub repository.

*Zero-Mail RSS — No servers. No tracking. No noise.*
