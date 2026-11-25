export interface ThemeSettings {
    readonly logo: string | null;
    readonly brandName: string;
    readonly tagline: string;
    readonly footer: string;
    readonly accent: string;
    readonly accentText: string;
    readonly success: string;
    readonly surface: 'graphite' | 'midnight' | 'oled';
    readonly radius: number;
    readonly density: 'comfortable' | 'compact';
    readonly contentWidth: number;
    readonly decor: boolean;
    readonly sidebarServer: boolean;
    readonly greeting: boolean;
    readonly dashboardStats: boolean;
    readonly switcherKey: string;
    readonly curseforgeKey: string;
    readonly livePlayers: boolean;
    readonly bannerEnabled: boolean;
    readonly bannerText: string;
    readonly bannerTone: 'info' | 'warning' | 'danger';
    readonly bannerLink: string;
    readonly bannerDismissible: boolean;
}
