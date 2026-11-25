import type { ComponentType } from 'react';
import type { ExtensionSetupContext, ScreenComponentProps } from '@pterodactyl/sdk';
import { defineTheme, lazyView } from '@pterodactyl/sdk/theme';
import { ui as manifestUi } from '../extension.json';
import { obsidianSkins } from './skins';
import AuthLayout from './views/AuthLayout';
import AreaLayout from './views/AreaLayout';
import Footer from './ui/Footer';
import { isMinecraft } from './tools/lib/minecraft';
import { applyStoredSurface } from './lib/surface';

if (typeof document !== 'undefined') {
    const html = document.documentElement;
    html.dataset.obsDefaultSurface ??= html.dataset.obsSurface ?? 'graphite';
    applyStoredSurface();
}

const visible = ({ server }: { server?: Parameters<typeof isMinecraft>[0] }) => isMinecraft(server);

const screenFiles = import.meta.glob<{ default: ComponentType<ScreenComponentProps> }>('./tools/screens/*Screen.tsx');
const registerHooks = import.meta.glob<{ default: (context: ExtensionSetupContext) => void }>('./**/*.register.ts', {
    eager: true,
});

export const screenFile = (id: string) =>
    `./tools/screens/${id.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase())}Screen.tsx`;

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
    setup(context) {
        const registered = new Set<string>();
        const screens = {
            register: (...args: Parameters<ExtensionSetupContext['screens']['register']>) => {
                registered.add(args[0]);
                context.screens.register(...args);
            },
        };
        for (const hook of Object.values(registerHooks)) hook.default({ ...context, screens });
        for (const { id } of manifestUi.screens) {
            const load = screenFiles[screenFile(id)];
            if (load && !registered.has(id)) context.screens.register(id, load, { visible });
        }
    },
});
