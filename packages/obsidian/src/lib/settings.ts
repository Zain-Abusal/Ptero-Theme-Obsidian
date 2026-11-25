import { useThemeSettings } from '@pterodactyl/sdk/theme';
import type { ThemeSettings } from '../theme-types';

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
        bannerEnabled: s.bannerEnabled ?? false,
        bannerText: s.bannerText ?? '',
        bannerTone: s.bannerTone === 'warning' || s.bannerTone === 'danger' ? s.bannerTone : 'info',
        bannerLink: s.bannerLink ?? '',
        bannerDismissible: s.bannerDismissible ?? true,
    };
}

export const brandName = (panelName: string, settings: ThemeSettings) => settings.brandName.trim() || panelName;
