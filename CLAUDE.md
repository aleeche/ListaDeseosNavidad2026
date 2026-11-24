# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Family Christmas wishlist web app ("Deseos de Navidad 2026"). Each family member keeps a wishlist; everyone sees all lists and can "reserve" a gift («Yo lo regalo») that stays hidden from the list owner. The user communicates in Spanish; all code identifiers, comments and UI copy are in Spanish.

Stack constraint chosen by the user: plain HTML + CSS + JavaScript (ES modules), **no build step, no npm, no frameworks**. Hosted on GitHub Pages via GitHub Actions; data in Firebase Firestore loaded from the gstatic CDN.

## Commands

```bash
python -m http.server 8000 -d site     # run locally → http://localhost:8000 (ES modules need http://, not file://)
```

There is no build, lint, or test suite. Verify changes manually in the browser. Locally the app runs in **modo demo** (`site/config.js` is `null` → data in localStorage), which exercises the whole UI. To exercise the Firestore path locally, serve a *copy* of `site/` with a temporary `config.js`; never commit a real config to `site/config.js`.

Deploy = push to `main` → `.github/workflows/publicar.yml` publishes the `site/` folder to GitHub Pages. Pages source must be set to "GitHub Actions" in repo settings (and the repo must be public on a free plan).

## Architecture

**Mode selection.** `site/config.js` is a classic script that sets `window.FIREBASE_CONFIG` before the `app.js` module runs. `null` → local/demo mode; an object → Firestore mode. In CI the workflow overwrites `site/config.js` from the repository variable `FIREBASE_CONFIG` (strict JSON, validated with `jq` to contain `apiKey` and `projectId`). An unset variable deploys demo mode with a warning.

**Store interface (keep both implementations in sync).** `js/app.js` lazily imports one of:
- `js/datos-local.js` — localStorage (`ldn.demo.datos`), syncs across tabs via the `storage` event.
- `js/datos-firebase.js` — Firestore with persistent local cache; SDK version pinned in `VERSION_FIREBASE`.

Both expose the same async API: `suscribir(alCambiar, alError)` (emits `{miembros, deseos}` arrays; returns unsubscribe), `agregarMiembro`, `actualizarMiembro`, `eliminarMiembro` (cascade: deletes the member's wishes and releases gifts they reserved), `agregarDeseo`, `actualizarDeseo`, `eliminarDeseo`, `reservarDeseo(id, miembroId)`, `liberarDeseo(id, miembroId)`. Reservations run in a Firestore transaction so two people can't reserve the same gift. Expected failures are thrown via `errorConCodigo()` with `code` `'ya-apartado'` or `'no-existe'`, and the UI handles them. Timestamps are `Date.now()` ms (not `serverTimestamp`) to keep the two stores identical.

**Data model** (Firestore paths; the demo store mirrors the same shapes):
- `familias/{codigoFamilia}/miembros/{id}` → `{nombre, emoji, creado}`
- `familias/{codigoFamilia}/deseos/{id}` → `{miembroId, titulo, enlace, precio, notas, prioridad (1–3), reservadoPor (miembroId|null), comprado, creado}`

**Security model.** There are no user accounts. The *código familiar* (random, e.g. `k7tq-mw3x-p9rd`) is a path segment that works as a shared password; the rules deny listing `/familias`. Cross-file invariants:
- The code format regex exists in both `js/util.js` (`codigoFamiliaValido`) and `firestore.rules` (`codigoValido()`); change both together.
- `firestore.rules` caps documents at 12 fields. Adding fields to a member or wish must stay within that cap.
- CI does **not** deploy `firestore.rules`. The user pastes it into the Firebase console, so tell them whenever it changes.
- The owner-surprise rule is UI-only: `tarjetaDeseo()` must never render reservation state when the list belongs to the current person (`esMia`). The data itself is readable by anyone with the family code.

**UI rendering (`js/app.js`).**
- Each Firestore/local snapshot re-renders the whole screen into `#app` with template strings. Every user-provided value must go through `esc()`.
- Links go through `normalizarEnlace()` (http/https only) both when saved and when rendered.
- Interaction is a single document-level click listener that dispatches on `data-accion` / `data-id` to the `acciones` map. To add a button, give it a `data-accion` and add a handler there.
- All forms and menus share one `<dialog id="dialogo">` via `abrirDialogo(html, alEnviar)`. If `alEnviar` returns a string, it is shown as a validation error and the dialog stays open.
- `confirmar()` swaps content inside an already-open dialog and ignores stale `close` events (it checks `dialogo.open`). Keep that guard when touching dialog flows.
- Firestore retries silently when it can't connect, so `conectar()` shows an error screen if no snapshot arrives within 12 s.

**Per-device state** (localStorage, always accessed through the try/catch-safe `almacen` helper):
- `ldn.familia`: the family code. An invite link `?familia=<code>` is consumed and stripped from the URL in `iniciar()`.
- `ldn.yo.<familia>`: which member this device is.

**Styling.** `css/estilos.css` is mobile-first with one main breakpoint at 680px. Colors are CSS variables in `:root` and are redefined under `prefers-color-scheme: dark`; use the tokens instead of hard-coded colors. The snow canvas (`js/nieve.js`) lives inside the header, pauses when the tab is hidden, and respects `prefers-reduced-motion`.

## Firebase setup

The full one-time setup (create project → Firestore Standard edition in production mode → paste `firestore.rules` → register a Web app → set the `FIREBASE_CONFIG` repo variable → enable Pages) is documented in `README.md`.
