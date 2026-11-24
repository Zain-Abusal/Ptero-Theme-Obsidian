# Obsidian for Pterodactyl v2

A premium theme for **Pterodactyl Panel v2** (built against `v2.0.0-beta.3`) with a full Minecraft toolkit built in,
using the panel's native theme and extension system. One package, no Blueprint.

[![CI](https://github.com/Zain-Abusal/Ptero-Theme-Obsidian/actions/workflows/ci.yml/badge.svg)](https://github.com/Zain-Abusal/Ptero-Theme-Obsidian/actions/workflows/ci.yml)

## Install

1. Download `obsidian-<version>.pteroext` from the [latest release](https://github.com/Zain-Abusal/Ptero-Theme-Obsidian/releases/latest).
2. Upload it on **Admin > Themes**, or from the panel's directory:

   ```sh
   php artisan p:extension:install obsidian-1.1.0.pteroext --enable
   php artisan p:theme:activate obsidian
   ```

3. Reload the browser.

To try it without switching everyone, skip `p:theme:activate` and choose **Preview for me** on Admin > Themes.
`php artisan p:theme:activate classic` switches back. To upgrade, install the new file with `--replace`.

> The Minecraft pages ship inside the theme, so they exist while Obsidian is the active theme.

## The look

- **Sidebar shell** with grouped server navigation (Basic, Minecraft, Tools, Configuration), a server card with live
  status, players and power buttons, and a highlight that slides between pages.
- **Server switcher** (press `S`, or `[` / `]` to step through servers) with a live preview, pins, groups and colours.
- **Quickcast** search (`Ctrl/⌘ + /`) for servers and pages.
- **Dashboard** with a greeting, totals (servers, online, players now, memory), filters, collapsible groups and ring
  gauges per server.
- **Console** in a framed card with search, warning/error filters, history, copy, download, share and pop-out.
- **Surfaces:** Graphite, Midnight, Nord, Forest, Ember, Rosé, Amethyst and OLED. Each is a complete look in both dark
  and light. Users pick theirs from the sidebar; admins set the default.
- **Smooth everything:** a circular reveal when switching dark and light, a still sidebar while pages fade in, and hover
  lifts. All of it is compositor-only and turns off with the system's "reduce motion".

### Server customization

Every server gets a **group, colour, icon and note** (paintbrush button on its row or in the sidebar card). Servers
without a `server-icon.png` get a template icon tinted to match the theme. Pick another glyph, or upload an image,
which becomes the server's real 64×64 `server-icon.png`.

This is saved in the server's own `.obsidian.json`, so everyone with access sees the same thing on every device. Users
without file access see the defaults.

## Minecraft tools

Shown only on Minecraft Java servers. Each page needs the subuser permission for what it does.

| Page | Does |
| --- | --- |
| Players | Online players, whitelist, operators, bans and everyone who joined; op, kick, ban, whitelist |
| Versions | Paper, Purpur, Folia, Vanilla, Fabric or Velocity on any version; keeps the old jar; EULA; Java picker |
| Plugins | Search Modrinth, Hangar, SpigotMC and CurseForge for the server's loader and version; enable, disable, delete |
| Mods | Modrinth and CurseForge mods for Fabric, Forge and NeoForge servers |
| Packs | Modrinth and CurseForge modpacks (Fabric packs install end to end), datapacks, and resource packs as the server pack |
| Kits | Six plugin bundles; plugins already installed are skipped |
| Properties | `server.properties` in plain words with a MOTD preview, plus form editors for Bukkit, Spigot and Paper configs |
| Worlds | List, switch, download, back up, reset and pre-generate (Chunky) worlds |
| Votifier | Installs NuVotifier, picks its port from the server's allocations, copies the key and token |
| Restarts | Daily or weekly restarts with in-game countdown warnings, on the panel's own schedules |
| Crash doctor | Reads the latest crash report or log and explains the cause with a fix |
| Importer | Worlds, datapacks, jars or archives from a link; extracts them and backs up the current world |

Downloads go from the browser straight to the server through the panel's signed upload, which avoids the panel's limit
of 5 server-side downloads per 10 minutes. Hosts that don't allow browser downloads fall back to the server downloading
the file itself. Every action goes through the panel's client API, so permissions apply as usual.

## Settings (Admin > Themes > Obsidian)

| Tab | Settings |
| --- | --- |
| Branding | Logo, brand name, sign-in tagline, footer text |
| Colours | Primary colour, text on primary, online colour, default surface |
| Layout | Corner radius, density, content width, background decoration, sidebar server card |
| Dashboard | Greeting, totals, switcher key |
| Integrations | CurseForge API key (turns CurseForge on), live player counts |

**What leaves the panel:** live player counts look up each running server's *public* address on mcsrvstat.us. You can
turn this off. The plugin, mod and version searches call the public Modrinth, Hangar, Spiget, CurseForge, PaperMC,
Purpur, Mojang and Fabric APIs. Logs go to mclo.gs only when someone presses Share or Deep analysis. Theme settings reach
every signed-in user's browser, so use a CurseForge key made only for this panel.

## Develop

```sh
git clone --depth 1 --branch v2.0.0-beta.3 https://github.com/pterodactyl/panel.git panel
(cd panel && npm ci && npm run sdk:generate && npm run sdk:testing)
npm ci
npm run release        # typecheck, test, build, then pack into release/themes/
```

- `npm run typecheck`, `npm test` and `npm run build` cover the whole workspace.
- With PHP and a dev panel, `php artisan p:extension:dev packages/obsidian --enable --watch` rebuilds and reloads on
  every change.
- `PREVIEW=/tmp/preview npx vitest run src/preview.spec.tsx` (in `packages/obsidian`) writes static pages of the main
  views for screenshots.

### Layout

```
packages/obsidian/
  extension.json          manifest: settings, screens
  src/theme.tsx           entry: skins, views, screen registration
  src/theme.css           tokens, surfaces, motion
  src/skins.ts            restyled panel primitives
  src/views/              shell, dashboard, console, account, sign-in
  src/lib/                settings, server meta, icons, players, surfaces
  src/tools/              Minecraft pages (screens/, lib/, ui/)
scripts/pack.mjs          builds the .pteroext (mirrors p:extension:pack)
```

### Adding a page

1. Add it to `ui.screens` in `extension.json` (path under `mc/`, a `nav.group`, the permissions it needs).
2. Create `src/tools/screens/<Name>Screen.tsx` and add it to `SCREENS` in `src/theme.tsx`.
3. Add tests next to it and open a pull request. CI typechecks, tests, builds and packs it, and attaches the
   `.pteroext` to the run so you can install and try it before merging.

### Releasing

Bump `version` in `packages/obsidian/extension.json` and `package.json`, then push a matching tag (`v1.2.0`). The
Release workflow builds the `.pteroext` and attaches it to a GitHub release as a plain file.

Fonts: Geist, Geist Mono and Instrument Serif (SIL Open Font License), bundled with the theme.
