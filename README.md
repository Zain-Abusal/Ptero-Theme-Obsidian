# Obsidian for Pterodactyl v2

A theme and a Minecraft toolkit for **Pterodactyl Panel v2** (built against `v2.0.0-beta.3`), using the panel's native
extension system. No Blueprint.

| Package | Id | What it is |
| --- | --- | --- |
| `packages/obsidian` | `obsidian` | The theme: sidebar shell, server switcher, Quickcast, dashboard, console, account and sign-in pages. |
| `packages/mc-toolkit` | `obsidian-mc` | Minecraft screens: Players, Versions, Plugins, Mods, Kits, Properties, Votifier, Importer. |

## Install on a panel

The two packages are separate releases, one per admin tab:

- `release/themes/obsidian-1.0.0.pteroext` goes in **Admin > Themes**.
- `release/extensions/obsidian-mc-1.0.0.pteroext` goes in **Admin > Extensions**.

Upload each in its tab, or copy them to the panel host and run from the panel's directory:

```sh
php artisan p:extension:install release/themes/obsidian-1.0.0.pteroext --enable
php artisan p:theme:activate obsidian
php artisan p:extension:install release/extensions/obsidian-mc-1.0.0.pteroext --enable
```

Reload the browser afterwards. To try the theme without switching everyone, skip `p:theme:activate` and pick
**Preview for me** on **Admin > Themes**. `php artisan p:theme:activate classic` switches back.

## Customise (Admin > Themes > Obsidian)

| Tab | Settings |
| --- | --- |
| Branding | Logo upload, brand name (falls back to the panel name), sign-in tagline, footer text |
| Colours | Primary colour, text on primary, online colour, surface (Graphite, Midnight blue, OLED black) |
| Layout | Corner radius, density, content width, background decoration, server card in the sidebar |
| Dashboard | Greeting, totals tiles, the server switcher key (default `S`) |

Users switch between dark and light from the sidebar. Pinned servers, recent servers and collapsed sidebar groups
are stored per browser.

**Keys:** `S` opens the server switcher (configurable). `[` and `]` step through servers. `Ctrl/⌘ + /` opens
Quickcast.

## The toolkit

The screens appear only on Minecraft Java servers, detected from the egg's features or tags, a jar invocation or a
Java image. Each one needs the subuser permission for what it does:

| Screen | Group | Needs | Does |
| --- | --- | --- | --- |
| Players | Basic | `control.console` | Online players via `list`, whitelist, ops, bans, everyone who joined; op/kick/ban/whitelist |
| Versions | Minecraft | `file.create` | Paper, Purpur, Folia, Vanilla, Fabric, Velocity on any version; keeps the old jar; EULA; Java image picker |
| Plugins | Minecraft | `file.create` | Search Modrinth, Hangar and SpigotMC, filtered to the loader and MC version; install, enable/disable, delete |
| Mods | Minecraft | `file.create` | The same browser for Fabric mods from Modrinth |
| Kits | Minecraft | `file.create` | Six plugin bundles; already installed plugins are skipped |
| Properties | Minecraft | `file.update` | server.properties in plain words: MOTD preview with colour codes, tiles, search, changes only, undo |
| Votifier | Minecraft | `file.update` | Installs NuVotifier, picks its port from the server's allocations, copies the key and token |
| Importer | Tools | `file.create` | Worlds, datapacks, jars or archives from a link; extracts; backs up the current world |

Everything runs through the panel's own client API (`files/pull`, `files/write`, `command`, `startup/variable`), so
Wings downloads files straight to the server and the panel's permissions apply. Searches go from the browser to
the public Modrinth, Hangar, Spiget, PaperMC, Purpur, Mojang, Fabric and GitHub APIs, which all allow it.

## Develop

```sh
git clone --depth 1 --branch v2.0.0-beta.3 https://github.com/pterodactyl/panel.git panel
(cd panel && npm ci && npm run sdk:generate && npm run sdk:testing)
npm install
npm run release        # typecheck, test, build, then pack into release/
```

`npm run build`, `npm test` and `npm run typecheck` run in every package. With a dev panel and PHP,
`php artisan p:extension:dev packages/obsidian --enable --watch` rebuilds and reloads open pages on every change.
`scripts/pack.mjs` mirrors `p:extension:pack`; with PHP available, the artisan command also runs the panel's checks.

### How the theme is built

- **Tokens** (`src/theme.css`) set every colour role, the radius, spacing and the terminal palette. Settings write
  `--obs-*` tokens and `data-obs-*` attributes on `<html>`.
- **Skins** (`src/skins.ts`) restyle the panel's primitives (Button, Card, Stat, Badge, Input, Dialog…), so every
  core page and every extension picks up the look.
- **Views** replace only what changes: `layout.app` (shell), `app.search`, `dashboard.serverList` and
  `.serverCard`, `page.server.console`, `server.terminal`, `server.stats`, `page.account.overview`,
  `layout.auth` and `page.auth.login`. Everything else is classic, restyled by the skins.
- Every slot the replaced views had is still rendered, so other extensions keep working.

Fonts: Geist, Geist Mono and Instrument Serif (SIL Open Font License), bundled with the theme.
