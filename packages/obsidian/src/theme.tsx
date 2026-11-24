import { defineTheme, lazyView } from '@pterodactyl/sdk/theme';
import { obsidianSkins } from './skins';
import AuthLayout from './views/AuthLayout';
import AreaLayout from './views/AreaLayout';
import Footer from './ui/Footer';
import { isMinecraft } from './tools/lib/minecraft';
import { applyStoredSurface } from './lib/surface';

// Remember the admin's surface, then apply the user's own before the first paint.
if (typeof document !== 'undefined') {
    const html = document.documentElement;
    html.dataset.obsDefaultSurface ??= html.dataset.obsSurface ?? 'graphite';
    applyStoredSurface();
}

/** The Minecraft pages exist only on Minecraft (Java) servers. */
const visible = ({ server }: { server?: Parameters<typeof isMinecraft>[0] }) => isMinecraft(server);

/** Page id → its lazily loaded screen. Paths, navigation and permissions are in extension.json. */
const SCREENS = {
    players: () => import('./tools/screens/PlayersScreen'),
    versions: () => import('./tools/screens/VersionsScreen'),
    plugins: () => import('./tools/screens/PluginsScreen'),
    mods: () => import('./tools/screens/ModsScreen'),
    kits: () => import('./tools/screens/KitsScreen'),
    properties: () => import('./tools/screens/PropertiesScreen'),
    votifier: () => import('./tools/screens/VotifierScreen'),
    importer: () => import('./tools/screens/ImporterScreen'),
    packs: () => import('./tools/screens/PacksScreen'),
    worlds: () => import('./tools/screens/WorldsScreen'),
    scheduler: () => import('./tools/screens/SchedulerScreen'),
    doctor: () => import('./tools/screens/DoctorScreen'),
};

/**
 * Obsidian. Everything that imports `@pterodactyl/sdk` is a lazy view, so the entry stays small: the
 * skins, the sign-in frame, the thin area layouts and the footer load first.
 */
export default defineTheme({
    ui: { ...obsidianSkins, PageFooter: Footer },
    views: {
        'layout.auth': AuthLayout,
        'page.auth.login': lazyView(() => import('./views/LoginPage')),
        'layout.app': lazyView(() => import('./views/Shell')),
        'layout.server': AreaLayout,
        'layout.account': AreaLayout,
        'layout.admin': AreaLayout,
        'app.search': lazyView(() => import('./views/Search')),
        'dashboard.serverList': lazyView(() => import('./views/ServerList')),
        'dashboard.serverCard': lazyView(() => import('./views/ServerCard')),
        'page.server.console': lazyView(() => import('./views/ConsolePage')),
        'server.terminal': lazyView(() => import('./views/Terminal')),
        'server.stats': lazyView(() => import('./views/Stats')),
        'page.account.overview': lazyView(() => import('./views/AccountOverview')),
    },
    setup({ screens }) {
        for (const [id, load] of Object.entries(SCREENS)) screens.register(id, load, { visible });
    },
});
