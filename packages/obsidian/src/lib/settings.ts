import { useThemeSettings } from '@pterodactyl/sdk/theme';
import type { ThemeSettings } from '../theme-types';

/** Obsidian's settings with every value defaulted, so a panel that never saved them still renders. */
export function useObsidian(): ThemeSettings {
    const s = useThemeSettings<Partial<ThemeSettings>>();

    return {
        logo: s.logo ?? null,
        brandName: s.brandName ?? '',
        tagline: s.tagline ?? 'Your servers, beautifully managed.',
        footer: s.footer ?? '',
        accent: s.accent ?? '#f4f4f5',
        accentText: s.accentText ?? '#0a0a0a',
        success: s.success ?? '#6ee7a0',
        surface: s.surface ?? 'graphite',
        radius: s.radius ?? 14,
        density: s.density ?? 'comfortable',
        contentWidth: s.contentWidth ?? 76,
        decor: s.decor ?? true,
        sidebarServer: s.sidebarServer ?? true,
        greeting: s.greeting ?? true,
        dashboardStats: s.dashboardStats ?? true,
        switcherKey: s.switcherKey ?? 's',
        curseforgeKey: s.curseforgeKey ?? '',
        livePlayers: s.livePlayers ?? true,
    };
}

/** The brand name: the theme's own when an administrator set one, else the panel's. */
export const brandName = (panelName: string, settings: ThemeSettings) => settings.brandName.trim() || panelName;
