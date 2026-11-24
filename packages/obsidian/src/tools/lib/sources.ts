import { getJson, safeName } from './api';
import { cfDownload, cfLatestFile, cfSearch } from './curseforge';

export type Source = 'modrinth' | 'hangar' | 'spigot' | 'curseforge';
export type Kind = 'plugin' | 'mod' | 'modpack' | 'datapack' | 'resourcepack';

export interface Project {
    readonly source: Source;
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly author: string;
    readonly description: string;
    readonly icon: string | null;
    readonly downloads: number;
    readonly updated: string | null;
    readonly tags: string[];
    readonly page: string;
    /** Spigot resources hosted elsewhere, or premium, cannot be downloaded by the server. */
    readonly external?: boolean;
}

export interface SearchOptions {
    readonly query: string;
    readonly kind: Kind;
    readonly loaders: string[];
    readonly gameVersion: string | null;
    readonly category: string | null;
    readonly offset: number;
    /** The CurseForge API key; CurseForge is skipped without one. */
    readonly cfKey?: string;
}

export interface Category {
    readonly id: string;
    readonly label: string;
    readonly modrinth: string | null;
    readonly hangar: string | null;
}

/** One set of categories across the three sources; a source without the category ignores it. */
export const categories: Category[] = [
    { id: 'all', label: 'Everything', modrinth: null, hangar: null },
    { id: 'admin', label: 'Admin', modrinth: 'management', hangar: 'admin_tools' },
    { id: 'economy', label: 'Economy', modrinth: 'economy', hangar: 'economy' },
    { id: 'social', label: 'Chat & social', modrinth: 'social', hangar: 'chat' },
    { id: 'gameplay', label: 'Gameplay', modrinth: 'game-mechanics', hangar: 'gameplay' },
    { id: 'adventure', label: 'Adventure', modrinth: 'adventure', hangar: 'role_playing' },
    { id: 'minigames', label: 'Minigames', modrinth: 'minigame', hangar: 'games' },
    { id: 'performance', label: 'Performance', modrinth: 'optimization', hangar: null },
    { id: 'worldgen', label: 'World gen', modrinth: 'worldgen', hangar: 'world_management' },
    { id: 'utility', label: 'Utility', modrinth: 'utility', hangar: 'misc' },
    { id: 'library', label: 'Libraries', modrinth: 'library', hangar: 'dev_tools' },
];

const PAGE = 18;

export const pageSize = PAGE;

// #region Modrinth
interface ModrinthHit {
    project_id: string;
    slug: string;
    title: string;
    author: string;
    description: string;
    icon_url: string | null;
    downloads: number;
    date_modified: string;
    display_categories: string[];
}

const MODRINTH_TYPES: Record<Kind, string[]> = {
    plugin: ['project_type:plugin', 'project_type:mod'],
    mod: ['project_type:mod'],
    modpack: ['project_type:modpack'],
    datapack: ['project_type:datapack'],
    resourcepack: ['project_type:resourcepack'],
};

/** The Modrinth "loaders" a kind's files are published under. */
export function modrinthLoaders(kind: Kind, loaders: string[]): string[] {
    if (kind === 'datapack') return ['datapack'];
    if (kind === 'resourcepack') return ['minecraft'];
    if (kind === 'modpack') return [];
    return loaders;
}

async function searchModrinth(o: SearchOptions): Promise<{ hits: Project[]; total: number }> {
    const category = categories.find((c) => c.id === o.category)?.modrinth;
    const facets: string[][] = [MODRINTH_TYPES[o.kind]];
    // Plugins and mods follow the server's loader; packs are chosen for what they are.
    if (o.kind === 'plugin' || o.kind === 'mod') facets.push(o.loaders.map((l) => `categories:${l}`));
    if (o.gameVersion) facets.push([`versions:${o.gameVersion}`]);
    if (category) facets.push([`categories:${category}`]);

    const params = new URLSearchParams({
        query: o.query,
        limit: String(PAGE),
        offset: String(o.offset),
        index: o.query ? 'relevance' : 'downloads',
        facets: JSON.stringify(facets),
    });
    const data = await getJson<{ hits: ModrinthHit[]; total_hits: number }>(`https://api.modrinth.com/v2/search?${params}`);

    return {
        total: data.total_hits,
        hits: data.hits.map((h) => ({
            source: 'modrinth',
            id: h.project_id,
            slug: h.slug,
            title: h.title,
            author: h.author,
            description: h.description,
            icon: h.icon_url || null,
            downloads: h.downloads,
            updated: h.date_modified,
            tags: h.display_categories.slice(0, 3),
            page: `https://modrinth.com/project/${h.slug}`,
        })),
    };
}

interface ModrinthVersion {
    version_number: string;
    loaders: string[];
    game_versions: string[];
    files: { url: string; filename: string; primary: boolean; size: number; hashes: { sha1?: string } }[];
}

export interface Resolved {
    readonly url: string;
    readonly filename: string;
    /** False when no build matched the Minecraft version and the newest was taken instead. */
    readonly exact: boolean;
    readonly sha1?: string;
    readonly loaders?: string[];
}

/** The newest file of a Modrinth project for these loaders, on this Minecraft version when there is one. */
export async function modrinthDownload(
    idOrSlug: string,
    loaders: string[],
    gameVersion: string | null
): Promise<Resolved> {
    const query = (withVersion: boolean) =>
        new URLSearchParams({
            ...(loaders.length ? { loaders: JSON.stringify(loaders) } : {}),
            ...(withVersion && gameVersion ? { game_versions: JSON.stringify([gameVersion]) } : {}),
        });
    const url = (withVersion: boolean) => `https://api.modrinth.com/v2/project/${idOrSlug}/version?${query(withVersion)}`;

    let versions = await getJson<ModrinthVersion[]>(url(true));
    const exact = versions.length > 0;
    if (!exact && gameVersion) versions = await getJson<ModrinthVersion[]>(url(false));
    const file = versions[0]?.files.find((f) => f.primary) ?? versions[0]?.files[0];
    if (!file) throw new Error(`No ${loaders[0] ?? ''} build of ${idOrSlug} was found.`.replace('  ', ' '));

    return { url: file.url, filename: safeName(file.filename), exact, sha1: file.hashes.sha1, loaders: versions[0].loaders };
}
// #endregion

// #region Hangar
interface HangarProject {
    name: string;
    namespace: { owner: string; slug: string };
    stats: { downloads: number };
    description: string;
    avatarUrl: string | null;
    lastUpdated: string;
    category: string;
}

const hangarPlatform = (loaders: string[]) => (loaders.includes('velocity') ? 'VELOCITY' : 'PAPER');

async function searchHangar(o: SearchOptions): Promise<{ hits: Project[]; total: number }> {
    const category = categories.find((c) => c.id === o.category)?.hangar;
    const params = new URLSearchParams({
        q: o.query,
        limit: String(PAGE),
        offset: String(o.offset),
        sort: o.query ? '-stars' : '-downloads',
        platform: hangarPlatform(o.loaders),
        ...(o.gameVersion ? { version: o.gameVersion } : {}),
        ...(category ? { category } : {}),
    });
    const data = await getJson<{ pagination: { count: number }; result: HangarProject[] }>(
        `https://hangar.papermc.io/api/v1/projects?${params}`
    );

    return {
        total: data.pagination.count,
        hits: data.result.map((p) => ({
            source: 'hangar',
            id: p.namespace.slug,
            slug: p.namespace.slug,
            title: p.name,
            author: p.namespace.owner,
            description: p.description,
            icon: p.avatarUrl,
            downloads: p.stats.downloads,
            updated: p.lastUpdated,
            tags: [p.category.replace(/_/g, ' ')],
            page: `https://hangar.papermc.io/${p.namespace.owner}/${p.namespace.slug}`,
        })),
    };
}

interface HangarVersion {
    name: string;
    downloads: Record<string, { downloadUrl: string | null; externalUrl: string | null; fileInfo: { name: string } | null }>;
}

/**
 * The newest release of a Hangar project for the platform. Some projects host their file elsewhere
 * (Floodgate does), so the version's direct `downloadUrl` or `externalUrl` is used rather than
 * Hangar's redirecting download route.
 */
export async function hangarDownload(slug: string, loaders: string[]): Promise<{ url: string; filename: string }> {
    const platform = hangarPlatform(loaders);
    const data = await getJson<{ result: HangarVersion[] }>(
        `https://hangar.papermc.io/api/v1/projects/${encodeURIComponent(slug)}/versions?limit=5&channel=Release&platform=${platform}`
    );
    const version = data.result.find((v) => v.downloads[platform]);
    const file = version?.downloads[platform];
    const url = file?.downloadUrl ?? file?.externalUrl;
    if (!version || !file || !url) throw new Error(`Hangar has no ${platform.toLowerCase()} release of ${slug}.`);

    const name = file.fileInfo?.name ?? (version.name === slug ? `${slug}.jar` : `${slug}-${version.name}.jar`);
    return { url, filename: safeName(name) };
}
// #endregion

// #region Spigot (Spiget)
interface SpigetResource {
    id: number;
    name: string;
    tag: string;
    external: boolean;
    premium?: boolean;
    downloads: number;
    updateDate: number;
    icon?: { data?: string };
    author?: { id: number };
}

async function searchSpigot(o: SearchOptions): Promise<{ hits: Project[]; total: number }> {
    const params = new URLSearchParams({
        size: String(PAGE),
        page: String(Math.floor(o.offset / PAGE) + 1),
        sort: '-downloads',
        fields: 'id,name,tag,external,premium,downloads,updateDate,icon',
    });
    const url = o.query
        ? `https://api.spiget.org/v2/search/resources/${encodeURIComponent(o.query)}?field=name&${params}`
        : `https://api.spiget.org/v2/resources/free?${params}`;
    const response = await fetch(url);
    // Spiget answers a search with no results as 404.
    if (response.status === 404) return { hits: [], total: 0 };
    if (!response.ok) throw new Error(`SpigotMC answered ${response.status}.`);
    const data = (await response.json()) as SpigetResource[];
    const total = Number(response.headers.get('X-Page-Count') ?? 1) * PAGE;

    return {
        total,
        hits: data.map((r) => ({
            source: 'spigot',
            id: String(r.id),
            slug: String(r.id),
            title: r.name,
            author: 'SpigotMC',
            description: r.tag,
            icon: r.icon?.data ? `data:image/png;base64,${r.icon.data}` : null,
            downloads: r.downloads,
            updated: r.updateDate ? new Date(r.updateDate * 1000).toISOString() : null,
            tags: [],
            page: `https://www.spigotmc.org/resources/${r.id}/`,
            external: r.external || r.premium === true,
        })),
    };
}
// #endregion

export function search(source: Source, options: SearchOptions) {
    if (source === 'curseforge') {
        if (!options.cfKey) return Promise.resolve({ hits: [], total: 0 });
        const kind = options.kind === 'plugin' || options.kind === 'mod' || options.kind === 'modpack' ? options.kind : 'mod';
        return cfSearch(options.cfKey, { ...options, kind, pageSize: PAGE });
    }
    if (source === 'hangar') return searchHangar(options);
    if (source === 'spigot') return searchSpigot(options);
    return searchModrinth(options);
}

/** Where the server downloads a project from, and the file name it gets. */
export async function downloadFor(
    project: Project,
    loaders: string[],
    gameVersion: string | null,
    kind: Kind = 'plugin',
    cfKey = ''
): Promise<Resolved> {
    if (project.source === 'modrinth') return modrinthDownload(project.id, modrinthLoaders(kind, loaders), gameVersion);
    if (project.source === 'curseforge') {
        if (project.external) throw new Error(`The author only allows downloads from CurseForge itself: ${project.page}`);
        const { file, exact } = await cfLatestFile(cfKey, project.id, gameVersion, kind === 'mod' ? loaders : []);
        return { ...cfDownload(file, project.page), exact };
    }
    if (project.source === 'hangar') return { ...(await hangarDownload(project.slug, loaders)), exact: true };
    if (project.external) throw new Error(`${project.title} is hosted outside SpigotMC; download it from its page.`);

    return { url: `https://api.spiget.org/v2/resources/${project.id}/download`, filename: safeName(`${project.title}.jar`), exact: true };
}

/** Letters and digits only, for matching a project against the jars already installed. */
export const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Whether one of the installed jar names looks like this project. */
export const looksInstalled = (names: readonly string[], ...keys: string[]) => {
    const wanted = keys.map(normalise).filter((k) => k.length >= 3);
    return names.some((name) => wanted.some((key) => normalise(name.replace(/\.jar$/i, '')).startsWith(key)));
};

export const compact = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);
