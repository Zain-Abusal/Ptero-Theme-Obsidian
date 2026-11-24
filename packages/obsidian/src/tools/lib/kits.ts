import { getJson, safeName } from './api';
import { hangarDownload, modrinthDownload } from './sources';

export type KitItem =
    | { readonly name: string; readonly source: 'modrinth'; readonly slug: string }
    | { readonly name: string; readonly source: 'hangar'; readonly slug: string }
    | { readonly name: string; readonly source: 'github'; readonly repo: string; readonly asset: RegExp };

export interface Kit {
    readonly id: string;
    readonly name: string;
    readonly eyebrow: string;
    readonly tone: 'success' | 'info' | 'accent' | 'warning' | 'danger' | 'neutral';
    readonly description: string;
    readonly items: readonly KitItem[];
}

export const kits: Kit[] = [
    {
        id: 'survival',
        name: 'Survival SMP',
        eyebrow: 'Most popular',
        tone: 'success',
        description: 'Claims, homes, rollbacks and a live web map. Everything a friendly survival server needs.',
        items: [
            { name: 'LuckPerms', source: 'modrinth', slug: 'luckperms' },
            { name: 'EssentialsX', source: 'modrinth', slug: 'essentialsx' },
            { name: 'GriefPrevention', source: 'modrinth', slug: 'griefprevention' },
            { name: 'CoreProtect', source: 'modrinth', slug: 'coreprotect' },
            { name: 'BlueMap', source: 'modrinth', slug: 'bluemap' },
            { name: 'Chunky', source: 'modrinth', slug: 'chunky' },
            { name: 'HuskHomes', source: 'modrinth', slug: 'huskhomes' },
        ],
    },
    {
        id: 'creative',
        name: 'Creative build',
        eyebrow: 'Builders',
        tone: 'accent',
        description: 'Fast WorldEdit, protected regions and separate worlds for plots and showcases.',
        items: [
            { name: 'FastAsyncWorldEdit', source: 'modrinth', slug: 'fastasyncworldedit' },
            { name: 'WorldGuard', source: 'modrinth', slug: 'worldguard' },
            { name: 'Multiverse-Core', source: 'modrinth', slug: 'multiverse-core' },
            { name: 'LuckPerms', source: 'modrinth', slug: 'luckperms' },
            { name: 'Chunky', source: 'modrinth', slug: 'chunky' },
        ],
    },
    {
        id: 'lobby',
        name: 'Lobby',
        eyebrow: 'Networks',
        tone: 'info',
        description: 'Holograms, a tidy tab list and locked-down spawn for the front door of a network.',
        items: [
            { name: 'DecentHolograms', source: 'modrinth', slug: 'decentholograms' },
            { name: 'TAB', source: 'modrinth', slug: 'tab-was-taken' },
            { name: 'WorldGuard', source: 'modrinth', slug: 'worldguard' },
            { name: 'WorldEdit', source: 'modrinth', slug: 'worldedit' },
            { name: 'LuckPerms', source: 'modrinth', slug: 'luckperms' },
            { name: 'PlaceholderAPI', source: 'modrinth', slug: 'placeholderapi' },
        ],
    },
    {
        id: 'crossplay',
        name: 'Crossplay',
        eyebrow: 'Bedrock + Java',
        tone: 'warning',
        description: 'Bedrock players join from phones and consoles, older Java versions connect, and skins just work.',
        items: [
            { name: 'Geyser', source: 'modrinth', slug: 'geyser' },
            { name: 'Floodgate', source: 'hangar', slug: 'Floodgate' },
            { name: 'ViaVersion', source: 'modrinth', slug: 'viaversion' },
            { name: 'ViaBackwards', source: 'modrinth', slug: 'viabackwards' },
            { name: 'SkinsRestorer', source: 'modrinth', slug: 'skinsrestorer' },
        ],
    },
    {
        id: 'community',
        name: 'Community',
        eyebrow: 'Social',
        tone: 'danger',
        description: 'Discord chat bridge, proximity voice chat, a polished tab list and vote rewards.',
        items: [
            { name: 'DiscordSRV', source: 'modrinth', slug: 'discordsrv' },
            { name: 'Simple Voice Chat', source: 'modrinth', slug: 'simple-voice-chat' },
            { name: 'TAB', source: 'modrinth', slug: 'tab-was-taken' },
            { name: 'PlaceholderAPI', source: 'modrinth', slug: 'placeholderapi' },
            { name: 'NuVotifier', source: 'github', repo: 'NuVotifier/NuVotifier', asset: /nuvotifier.*\.jar$/i },
        ],
    },
    {
        id: 'staff',
        name: 'Staff toolkit',
        eyebrow: 'Moderation',
        tone: 'neutral',
        description: 'Permissions, block logging and an anti-cheat, for servers that are growing up.',
        items: [
            { name: 'LuckPerms', source: 'modrinth', slug: 'luckperms' },
            { name: 'CoreProtect', source: 'modrinth', slug: 'coreprotect' },
            { name: 'GrimAC', source: 'modrinth', slug: 'grimac' },
            { name: 'EssentialsX', source: 'modrinth', slug: 'essentialsx' },
        ],
    },
];

export async function githubDownload(repo: string, asset: RegExp): Promise<{ url: string; filename: string }> {
    const release = await getJson<{ assets: { name: string; browser_download_url: string }[] }>(
        `https://api.github.com/repos/${repo}/releases/latest`
    );
    const file = release.assets.find((a) => asset.test(a.name));
    if (!file) throw new Error(`The latest ${repo} release has no matching jar.`);
    return { url: file.browser_download_url, filename: safeName(file.name) };
}

export async function kitItemDownload(item: KitItem, loaders: string[], gameVersion: string | null) {
    if (item.source === 'modrinth') return modrinthDownload(item.slug, loaders, gameVersion);
    if (item.source === 'hangar') return hangarDownload(item.slug, loaders);
    return githubDownload(item.repo, item.asset);
}

export const itemKeys = (item: KitItem) => [item.name, item.source === 'github' ? item.repo.split('/')[1] : item.slug];
