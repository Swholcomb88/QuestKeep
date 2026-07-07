# ⛨ QuestKeep

**Plan your day, guard your data.** An encrypted, offline-first time-blocking PWA — AES-256 vault, zero dependencies, nothing readable ever leaves your device.

---

## Features

- 🔒 **Client-side AES-256-GCM encryption** — PBKDF2 key derivation (250k iterations) from a passphrase only you know. The vault is genuinely encrypted, not just password-gated.
- 📴 **Offline-first PWA** — installs to your home screen, works fully offline after first load via service worker caching.
- 🕐 **Time-block scheduling** — block any slot in minutes, with quick +30m/+1h shortcuts and overlap detection.
- 🚗 **Auto work + commute blocking** — Mon–Fri work hours and drive time populate automatically; override any single day.
- 📊 **Day tape** — a visual timeline strip showing your whole day at a glance, with a live "now" marker.
- 📈 **Monthly progress** — one glanceable percentage tracking daily completion across the month.
- 💎 **Gem vault** — finish a day at 100% and mint a gem. Colors cycle through a real spinel collection (pink, berry red, lavender, teal) — a visible reward trail for consistency.
- 📝 **Daily journal** — notes for wins, blockers, anything.
- 🔁 **Reusable activity library** — save your regulars once, tap instead of retype.
- ⬇️⬆️ **Encrypted backup & restore** — export your vault as a portable `.qkv` file, restore it on any device with your original passphrase.

## Screenshot

*(Add a screenshot of the Today view here — the day tape + progress card sells it in one glance.)*

---

## Deploy (one time, ~5 minutes)

1. Create a new GitHub repo, e.g. `questkeep` (public is fine — the repo holds only code; your data lives encrypted in your phone's localStorage).
2. Upload all files to the repo root (`Add file → Upload files`).
3. Repo `Settings → Pages → Source: Deploy from a branch → main / (root) → Save`.
4. Wait ~1 minute. Your app is live at:
   `https://<your-username>.github.io/questkeep/`

## Install on your phone

1. Open that URL in Chrome (Android) or Safari (iOS).
2. Menu → **Add to Home Screen** (Android may show an "Install app" prompt).
3. Launch from the icon — full-screen, no browser chrome, works offline after the first load.

## First run

- Create a passphrase (6+ chars). **It cannot be recovered if lost** — the vault is genuinely encrypted, not password-gated.
- ⚙ settings → adjust work hours / commute if needed.

## Backups & moving devices

- ⚙ → **Export vault** downloads `questkeep-backup-YYYY-MM-DD.qkv` (your encrypted vault + salt; useless without your passphrase).
- New phone: open the app URL → lock screen → **Restore from a backup file** → pick the .qkv → unlock with the passphrase the backup was made under.
- localStorage is per-device; export/restore is how you sync phone ↔ PC.
- If device storage ever fills up, the app shows a red banner and offers an emergency export straight from memory — nothing is lost silently.

## Updating the app later

Replace `index.html` in the repo. Bump the cache name in `sw.js` (`questkeep-v2` → `questkeep-v3`) so installed phones pick up the new version.

## Verified by automated tests (`tests.js`)

1. Encrypt → decrypt round-trip preserves data exactly
2. Ciphertext contains no plaintext
3. Wrong passphrase fails cleanly (never returns garbage data)
4. Export → import on a fresh device restores an identical vault
5. Malformed/foreign files are rejected on import
6. Storage-full: save fails gracefully, user is warned, emergency export works
7. Legacy `.slv` backups from an earlier version still import

## Tech

Vanilla HTML/CSS/JS — no build step, no framework, no external runtime dependencies. Encryption via the browser's native Web Crypto API.
