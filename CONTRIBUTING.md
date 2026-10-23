# Contributing

Thanks for helping! Issues, ideas, translations, docs and code are all welcome.

## Quick start

```bash
npm install          # dev tools included
npm run dev          # server with auto-reload on http://localhost:8787
npm test             # unit + API tests
npm run build:web    # standalone browser edition → dist/web
npm run desktop      # run the desktop app (Electron)
```
The UI has no build step: edit files in `web/` and refresh. See `docs/ARCHITECTURE.md`.

## Ground rules

- **Original work only.** Don't add code, images, icons, fonts, screenshots or text copied from other products (including Anthropic's). Third-party code must have a compatible open-source license and be listed by `node scripts/gen-licenses.mjs`.
- **No trademarks.** Don't add other companies' logos or imply affiliation (see `TRADEMARKS.md`).
- **Safety stays in code.** Sensitive tools must declare an approval `category`; don't bypass `policy.js`.
- **Privacy by default.** No telemetry, analytics or third-party requests unless the user turns a feature on (and document it in `PRIVACY.md`).
- Keep the UI consistent with the design tokens in `web/css/tokens.css`; no hard-coded colors.
- Add or update tests for behavior changes.

## Pull requests

1. Fork, create a branch, make focused commits.
2. `npm test` must pass.
3. Describe what changed and how you tested it (screenshots for UI changes).

By contributing you agree that your contribution is licensed under the MIT License of this project.

## Translations

UI strings live in `web/js/lib/i18n.js` (English strings are the keys). Add a dictionary for your language and an entry in `LANGUAGES`.

## Code of conduct

Be kind and constructive. See `CODE_OF_CONDUCT.md`.
