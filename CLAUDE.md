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

Both expose the same async API: `suscribir(alCambiar, alError)` (emits `{miembros, deseos}` arrays; returns unsubscribe), `agregarMiembro`, `actualizarMiembro`, `eliminarMiembro` (cascade: deletes the member's wishes and releases gifts they reserved), `agregarDeseo`, `marcarComprado(id, comprado)`, `eliminarDeseo`, `reservarDeseo(id, miembroId)`, `liberarDeseo(id, miembroId)`. There is deliberately no way to update a wish's content (see "Immutable wishes" below). Reservations run in a Firestore transaction so two people can't reserve the same gift. Expected failures are thrown via `errorConCodigo()` with `code` `'ya-apartado'` or `'no-existe'`, and the UI handles them. Timestamps are `Date.now()` ms (not `serverTimestamp`) to keep the two stores identical.

**Data model** (Firestore paths; the demo store mirrors the same shapes):
- `familias/{codigoFamilia}/miembros/{id}` → `{nombre, emoji, creado}`
- `familias/{codigoFamilia}/deseos/{id}` → `{miembroId, titulo, enlace, precio, notas, prioridad (1–3), reservadoPor (miembroId|null), comprado, creado}`

**Security model.** There are no user accounts. The *código familiar* (random, e.g. `k7tq-mw3x-p9rd`) is a path segment that works as a shared password; the rules deny listing `/familias`. Cross-file invariants:
- The code format regex exists in both `js/util.js` (`codigoFamiliaValido`) and `firestore.rules` (`codigoValido()`); change both together.
- `firestore.rules` caps documents at 12 fields. Adding fields to a member or wish must stay within that cap.
- CI does **not** deploy `firestore.rules`. The user pastes it into the Firebase console, so tell them whenever it changes.
- The owner-surprise rule is UI-only: `tarjetaDeseo()` must never render reservation state when the list belongs to the current person (`esMia`). The data itself is readable by anyone with the family code. The same applies to the admin's delete-confirmation text on their own list.

**Admin and immutable wishes.**
- Admin = the family's oldest member (`adminFamilia()` in `app.js`, i.e. whoever created the family and joined first). No stored flag, so existing families need no migration. It is UI-only by the user's choice (no PIN, no Firebase Auth): anyone who picks the admin's name acts as admin.
- Only the admin sees «Eliminar» on wishes (any list) and «Eliminar a X de la familia» (other members, never themselves, since deleting the oldest member would hand admin to someone else). Non-admins cannot delete their own profile because the cascade would delete their wishes.
- Wishes are immutable once created so a giver never buys something that changed afterwards. Editing can't be allowed only while unreserved, because hiding the edit button would reveal to the owner that a gift was reserved. `firestore.rules` enforces this (`cambioPermitido()`: a wish update may only touch `reservadoPor` and `comprado`). If you add a mutable wish field, add it to that `hasOnly` list too.
- Adding a wish is two steps: `formDeseo()` validates and `confirmarDeseo()` shows a preview with the "can't be changed" warning. «← Corregir» reopens the form from `borradorDeseo`.

**UI rendering (`js/app.js`).**
- Each Firestore/local snapshot re-renders the whole screen into `#app` with template strings. Every user-provided value must go through `esc()`.
- Links go through `normalizarEnlace()` (http/https only) both when saved and when rendered.
- Interaction is a single document-level click listener that dispatches on `data-accion` / `data-id` to the `acciones` map. To add a button, give it a `data-accion` and add a handler there.
- All forms and menus share one `<dialog id="dialogo">` via `abrirDialogo(html, alEnviar)`. If `alEnviar` returns a string, it is shown as a validation error and the dialog stays open. If `alEnviar` calls `abrirDialogo` again (a next step), the old form is detached and the dialog also stays open (`form.isConnected` check). When swapping content in an already-open dialog, `[autofocus]` is focused manually.
- **No page scroll outside phones.** At ≥680px wide and ≥600px tall, `body` is exactly the viewport height. A long list scrolls inside its card (`.panel-cuerpo`, gold thin scrollbar, faded edges), so panels must keep their scrollable content inside `.panel-cuerpo`. Phones (portrait and landscape) keep normal page scroll.
  - Because every snapshot re-renders `#app`, `pantallaPrincipal()` restores `.panel-cuerpo` `scrollTop` when the view (`data-vista`) is unchanged.
  - Header sizes also scale with viewport height (`vh` inside the `clamp()`s). On wide and short screens (≥1240px wide, ≤820px tall) the countdown sits beside the title in the same row.
- Dialog scrolling: the `<dialog>` itself never scrolls (`.dialogo[open]` is a flex column with `overflow: hidden`). Its single child scrolls instead, with a thin gold scrollbar inside the frame, so dialog HTML must keep exactly one root element.
- `.dialogo-acciones` sticks to the bottom (`bottom: -24px` offsets the child's padding). `marcarDesborde()` toggles `.desborda` when the content overflows; that class adds the bar's background, top line and shadow. It runs on open, on content swap, on resize and when a validation error shows. Errors scroll into view, and `scroll-margin-bottom` keeps them clear of the bar.
- `confirmar()` swaps content inside an already-open dialog and ignores stale `close` events (it checks `dialogo.open`). Keep that guard when touching dialog flows.
- Firestore retries silently when it can't connect, so `conectar()` shows an error screen if no snapshot arrives within 12 s.
- **Santa's sleigh.** Tapping «Yo lo regalo» sets `estado.trineo = {id, inicio}` and Santa's sleigh (`js/trineo.js`, hand-drawn inline SVG: Santa, gifts, two galloping reindeer, gold sparkle trail) crosses that card left→right in `DURACION_TRINEO` ms. It starts on click, before the store confirms, and the button stays disabled meanwhile. It's cancelled if the reservation fails. It is per-device and never rendered on your own list (`esMia`).
  - Because snapshots re-render the card, `tarjetaDeseo()` re-emits the sleigh with `--desfase` = minus the elapsed time, so the CSS animations resume instead of restarting.
  - The crossing is two synced linear animations: `.trineo-viaje` moves 100 % of the card width and `.trineo-arte` moves its own width (`--ancho-arte`), so it enters and exits fully at any card size. Keep the `aspect-ratio` in `.trineo-arte` equal to the SVG viewBox.
  - The gold of the reserved card is painted behind the sleigh as it goes. While flying, the card has `.en-vuelo`, which restores the normal look. `.trineo-pintura` (z-index −1 under the text, thanks to `isolation: isolate` on `.deseo`) has the exact `.deseo.mio` look and is revealed by a gradient mask driven by the registered property `--avance` (0→1, same timing as the trip). Its edge sits at the sleigh's front: the `0.48 * --ancho-arte` in the mask is the part of the drawing ahead of it. If you move the sleigh inside the SVG, update that factor.
  - A document `animationend` listener removes both layers and `.en-vuelo` when `trineo-cruza` ends, leaving the identical `.mio` gold. It is skipped with `prefers-reduced-motion`.
- **«Comprado» hop.** Checking a gift in «Mis compras» sets `estado.salto = {id, inicio}`. `atributosCheck()` adds `.salta` plus a negative `--desfase` for `DURACION_SALTO` ms, so the pill's little jump survives the snapshot re-render. Unchecking doesn't animate.

**Per-device state** (localStorage, always accessed through the try/catch-safe `almacen` helper):
- `ldn.familia`: the family code. An invite link `?familia=<code>` is consumed and stripped from the URL in `iniciar()`.
- `ldn.yo.<familia>`: which member this device is.
- `ldn.navidad.<año>`: the Christmas midnight celebration already played on this device that year.

**Styling.** `css/estilos.css` is mobile-first with one main breakpoint at 680px. Colors are CSS variables in `:root`; use the tokens instead of hard-coded colors. There is a single dark theme (`color-scheme: dark`) in both system modes, so don't add a `prefers-color-scheme` block. The snow canvas (`js/nieve.js`) lives inside the header, pauses when the tab is hidden, and respects `prefers-reduced-motion`. The live countdown (`js/cuenta.js`, using `tiempoParaNavidad()` from `util.js`) counts to local midnight Dec 24→25. It always shows the four sheets with two digits (on Dec 24 the days sheet stays at 00) and «¡Feliz Navidad!» from Dec 25 to 31. It updates the numbers in place each second; `#cuenta` has `role="timer"`, so don't add `aria-live` to it. Each unit is a calendar sheet (`.hoja`): a red band with the unit, a Fraunces number on paper and a fold line.
- **Last week.** `tiempoParaNavidad()` also returns `nivel`: 0 until Dec 17, then 1 (Dec 18) to 7 (Dec 24), and it stays 7 on Christmas.
  - From nivel 1, a garland of 7 bulbs (`.cuenta-luces`) hangs over the sheets. `nivel` of them are lit, so the unlit ones equal the full days left. Today's bulb (`.de-hoy`) pulses, and at 7 (`.todas`) the light chases through all of them.
  - The bulbs reuse the frame lights' `#resplandor` glow filter (defined in the `.luces` SVG in `index.html`).
  - `iniciarCuenta(el, {alCambiarNivel})` also thickens the header snow (`iniciarNieve()` returns `{intensidad(factor)}`).
- **Midnight.** When the phase turns `navidad` live, `celebrar()` runs:
  - the 00 sheets each spin a full turn on their fold, staggered, ending edge-on (`.girando`, `GIRO_MS`), then the «¡Feliz Navidad!» sheet flips down (`.llega`);
  - Santa's sleigh crosses the header sky (`.santa-cielo`, reusing `arteTrineo({regalos: true})` from `trineo.js`, behind the content and frame lights) dropping gifts;
  - `body.fiesta` makes the frame lights flash.
  - If nobody was watching, it plays the first time the app is opened during Christmas (once per device and year), after the intro (`ldn:intro-fin` event from `intro.js`) and when the tab is visible. The «¡Feliz Navidad!» sheet is a `data-accion="celebrar"` button that replays it. With `prefers-reduced-motion` it only shows the final sheet.

**Visual language.**
- **Icons.** Lucide icons (ISC; license notice in `index.html`) live as `<symbol id="i-…">` in a hidden sprite at the top of `index.html`. Render them with `icono(nombre, clase)` from `util.js`. To add one, paste its SVG children from lucide-static into a new `<symbol>`. Icons are single-stroke and inherit `currentColor`; gold (`--oro`) marks states, priority stars (`icono-lleno` = filled), the admin crown and the hourglass.
- **No emoji in the UI chrome.** The exceptions are member avatars (the character each person picks), the WhatsApp invite text and the favicon.
- **Christmas-card look.** The whole page is styled like a Christmas card the user picked: card green with faint Lucide snowflakes (`--copos`) inside a sand-gray frame (`body::after`, inset `--marco-margen`, on the darker `--exterior`).
  - **Decorations:** hand-drawn holly (`#acebo` symbol in the sprite) sits on the top-left and bottom-right frame corners (`.acebo`). A string of warm lights (`.luces`, an SVG `<pattern>`) hangs from the top of the frame. All of them are absolutely positioned in `body`, which is `position: relative`.
  - **Clearance:** `.hero` top padding and `.pagina` bottom padding keep content clear of the holly and the frame, scaled by `--acebo` (there is no footer). On narrow screens the session pill moves to its own row next to the holly.
  - **Type:** headings (h1/h2) use Kaushan Script, which only has weight 400, so never set it to bold. Eyebrows ("★ LISTA FAMILIAR · 2026", the countdown title) use letter-spaced Fraunces caps. Body text is Nunito.
  - **Accents:** `--pino`/`--oro` are the star gold («Yo lo regalo», active and focus states) and `--accion` is the berry red (primary buttons). Dialogs look like a small framed card.
  - **Texture:** a subtle SVG noise (`--grano`) is applied via `body::before`.
- **Rules and notices go in the help dialog, not in the cards.** `ayuda()` (`data-accion="ayuda"`) holds them; it opens from the «?» in each panel header, the menu and the «Modo demo» pill in the header. Keep list cards focused on the gifts.

**Intro animation.** A star tree (inline SVG in `index.html`, inspired by a CodePen by Uwe Chardon; each path's `--no` is its pop-in order) plays for about 3.5 s once per browser session. The original's lean and bottom-right tail were removed: stars were remapped into a symmetric triangle whose apex is at x=50 (viewBox `3 -1 94 134`), with a level base. Keep it centered on x=50 if you edit it. The SVG is sized by height (`.intro svg`).
- Timeline: stars pop in bottom→top, a wave of light (`intro-encender`) lights the tree bottom→top, the top star (`.punta`) flares with its `.halo` (radial gradient circle), then the stars float up and fade (`intro-disolver`, per-star `--sube`/`--deriva`) while the top star leaves with a last flare and the overlay fades.
- Star colors use `path:nth-of-type()` (not `nth-child`) because `<defs>` and the halo come before the paths.
- An inline `<script>` in `<head>` decides before first paint: it checks `sessionStorage` `ldn.intro` and `prefers-reduced-motion`, then adds `html.intro-activa`.
- The CSS (`.intro*` and `@keyframes intro-*` in `estilos.css`) drives the whole timeline. It ends with the overlay invisible and click-through, so it can't get stuck if JS fails.
- `js/intro.js` only adds `.intro-saltar` on click or keypress and removes the overlay on its own `animationend`. Star `animationend` events bubble, so it filters by `e.target`.

## Firebase setup

The full one-time setup (create project → Firestore Standard edition in production mode → paste `firestore.rules` → register a Web app → set the `FIREBASE_CONFIG` repo variable → enable Pages) is documented in `README.md`.
