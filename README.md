# QuestKeep — Deploy Guide (GitHub Pages)

Encrypted daily time-block planner. Vault is AES-256-GCM encrypted on-device;
nothing readable ever leaves your phone.

## Files
- `index.html` — the entire app (logo embedded)
- `manifest.json` — PWA manifest (app name, icons, standalone display)
- `sw.js` — service worker (offline caching)
- `icon-192.png`, `icon-512.png` — home-screen icons

## Deploy (one time, ~5 minutes)
1. Create a new GitHub repo, e.g. `questkeep` (public is fine — the repo holds
   only code; your data lives encrypted in your phone's localStorage).
2. Upload all 5 files to the repo root (`Add file → Upload files`).
3. Repo `Settings → Pages → Source: Deploy from a branch → main / (root) → Save`.
4. Wait ~1 minute. Your app is live at:
   `https://<your-username>.github.io/questkeep/`

## Install on your phone
1. Open that URL in Chrome (Android) or Safari (iOS).
2. Menu → **Add to Home Screen** (Android may show an "Install app" prompt).
3. Launch from the icon — full-screen, no browser chrome, works offline
   after the first load.

## First run
- Create a passphrase (6+ chars). **It cannot be recovered if lost** — the
  vault is genuinely encrypted, not password-gated.
- ⚙ settings → adjust work hours / commute if needed.

## Backups & moving devices
- ⚙ → **Export vault** downloads `questkeep-backup-YYYY-MM-DD.qkv`
  (your encrypted vault + salt; useless without your passphrase).
- New phone: open the app URL → lock screen → **Restore from a backup file**
  → pick the .qkv → unlock with the passphrase the backup was made under.
- localStorage is per-device; export/restore is how you sync phone ↔ PC.
- If device storage ever fills up, the app shows a red banner and offers an
  emergency export straight from memory — nothing is lost silently.

## Updating the app later
Replace `index.html` in the repo. Bump the cache name in `sw.js`
(`questkeep-v1` → `questkeep-v2`) so installed phones pick up the new version.

## Verified by automated tests
1. Encrypt → decrypt round-trip preserves data exactly
2. Ciphertext contains no plaintext
3. Wrong passphrase fails cleanly (never returns garbage data)
4. Export → import on a fresh device restores an identical vault
5. Malformed/foreign files are rejected on import
6. Storage-full: save fails gracefully, user is warned, emergency export works
7. Legacy .slv backups from the artifact version still import
