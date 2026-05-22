# Feature Spec: Safer Blocking Controls

## Goals

- Let trusted domains bypass blacklist rules.
- Show whether a draft rule matches the current active tab before saving.
- Record recent blocked tabs so false positives can be diagnosed.

## Whitelist Domains

### Storage

- Key: `whitelistDomains`
- Namespace: `chrome.storage.sync`
- Shape: `string[]`
- Default: `[]`

### Matching

Whitelist wins over blacklist. Decision order:

1. Extension disabled: allow.
2. URL is special or unparsable: allow.
3. Host matches `whitelistDomains`: allow.
4. Host matches `nameBlacklist` or `suffixBlacklist`: block.
5. Otherwise: allow.

Whitelist entries match exact domain and subdomains:

| Whitelist rule | Matched host examples |
|---|---|
| `example.com` | `example.com`, `www.example.com` |
| `.example.com` | `example.com`, `ads.example.com` |

### Popup behavior

- User can add/remove whitelist entries from popup.
- Whitelist entries persist across popup close and extension reload.
- Import/export includes `whitelistDomains` with existing blacklist data.

## Rule Preview

### Trigger

Preview updates while user types in:

- Domain name blacklist input.
- Domain suffix blacklist input.
- Whitelist input.

### Target URL

Popup reads active tab URL with:

```js
chrome.tabs.query({ active: true, currentWindow: true })
```

### Behavior

- Empty input hides preview.
- Special or unavailable active tab shows neutral message.
- Matching draft rule shows match message.
- Non-matching draft rule shows no-match message.
- Preview never saves data; user still must press Enter or add button.
- Preview must use shared `BlockerUtils` logic.

## Recent Blocked Log

### Storage

- Key: separate local-storage key for recent blocked entries.
- Namespace: `chrome.storage.local`
- Max entries: 50.
- Sort order in popup: newest first.

### Entry shape

```json
{
  "timestamp": "2026-05-23T00:00:00.000Z",
  "url": "https://ads.example.com/path",
  "hostname": "ads.example.com",
  "reason": "name",
  "matchedRule": "ads",
  "source": "onUpdated"
}
```

### Behavior

- Append only after tab removal succeeds.
- Do not log allowed, disabled, whitelisted, special, or unparsable URLs.
- Popup shows empty state when log has no entries.
- Popup has clear-log action.

## Manual Verification

1. Load unpacked extension from `chrome://extensions/`.
2. Add name blacklist rule; matching tab closes and stats increment.
3. Add suffix blacklist rule; matching tab closes and stats increment.
4. Add same domain to blacklist and whitelist; matching tab stays open.
5. Type matching and non-matching draft rules; preview updates for all three inputs.
6. Trigger blocked tabs; recent log shows newest entries first.
7. Clear recent log; empty state appears.
8. Export JSON; verify `whitelistDomains` exists.
9. Import JSON with replace and merge; verify whitelist and blacklists persist.
