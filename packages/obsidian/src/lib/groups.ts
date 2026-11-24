import type { NavItem } from '@pterodactyl/sdk/theme';

/**
 * Core server pages have no group, so Obsidian files them by id; extension screens name their own
 * group in their manifest (`nav.group`) and land in "Extensions" without one.
 */
const CORE_GROUPS: Record<string, string> = {
    index: 'Basic',
    files: 'Basic',
    databases: 'Tools',
    backups: 'Tools',
    schedules: 'Tools',
    users: 'Configuration',
    network: 'Configuration',
    startup: 'Configuration',
    settings: 'Configuration',
    activity: 'Configuration',
};

const ORDER = ['Basic', 'Minecraft', 'Tools', 'Configuration'];

export interface NavGroup {
    readonly name: string;
    readonly items: NavItem[];
}

export function groupServerNav(items: readonly NavItem[]): NavGroup[] {
    const groups = new Map<string, NavItem[]>();

    for (const item of items) {
        const name = item.group ?? (item.extensionId ? 'Extensions' : (CORE_GROUPS[item.id] ?? 'Configuration'));
        groups.set(name, [...(groups.get(name) ?? []), item]);
    }

    const rank = (name: string) => {
        const i = ORDER.indexOf(name);
        return i === -1 ? ORDER.length : i;
    };

    return [...groups.entries()]
        .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
        .map(([name, list]) => ({ name, items: list }));
}
