import { safeName } from './api';
import type { Project } from './sources';

/**
 * CurseForge's API (https://docs.curseforge.com). Every call needs the administrator's key in
 * `x-api-key`; CORS allows that header from any origin.
 */
const API = 'https://api.curseforge.com/v1';
const MINECRAFT = 432;

export const CF_CLASS = { plugin: 5, mod: 6, modpack: 4471 } as const;
export type CfKind = keyof typeof CF_CLASS;

/** CurseForge's ModLoaderType enum. */
const LOADER_TYPES: Record<string, number> = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };

export const cfLoaderType = (loaders: readonly string[]): number | null => {
    for (const loader of loaders) if (loader in LOADER_TYPES) return LOADER_TYPES[loader];
    return null;
};

export interface CfMod {
    id: number;
    name: string;
    slug: string;
    summary: string;
    downloadCount: number;
    dateModified: string;
    logo: { thumbnailUrl?: string; url?: string } | null;
    authors: { name: string }[];
    links: { websiteUrl?: string | null };
    categories: { name: string }[];
    allowModDistribution?: boolean | null;
}

export interface CfFile {
    id: number;
    fileName: string;
    downloadUrl: string | null;
    gameVersions: string[];
    serverPackFileId?: number | null;
    isServerPack?: boolean;
}

async function cf<T>(key: string, path: string, params: Record<string, string | number | null | undefined> = {}): Promise<T> {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') query.set(k, String(v));
    const response = await fetch(`${API}${path}${query.size ? `?${query}` : ''}`, {
        headers: { Accept: 'application/json', 'x-api-key': key },
    });
    if (response.status === 403) throw new Error('CurseForge rejected the API key. Check it on Admin > Themes > Integrations.');
    if (!response.ok) throw new Error(`CurseForge answered ${response.status}.`);
    return (await response.json()) as T;
}

/** A CurseForge project in the browser's shape. Projects that forbid third-party downloads are external. */
export function cfToProject(mod: CfMod): Project {
    return {
        source: 'curseforge',
        id: String(mod.id),
        slug: mod.slug,
        title: mod.name,
        author: mod.authors[0]?.name ?? 'CurseForge',
        description: mod.summary,
        icon: mod.logo?.thumbnailUrl || mod.logo?.url || null,
        downloads: mod.downloadCount,
        updated: mod.dateModified,
        tags: mod.categories.slice(0, 3).map((c) => c.name),
        page: mod.links.websiteUrl || `https://www.curseforge.com/minecraft/search?search=${encodeURIComponent(mod.slug)}`,
        external: mod.allowModDistribution === false,
    };
}

export async function cfSearch(
    key: string,
    o: { query: string; kind: CfKind; gameVersion: string | null; loaders: readonly string[]; offset: number; pageSize: number }
): Promise<{ hits: Project[]; total: number }> {
    const data = await cf<{ data: CfMod[]; pagination: { totalCount: number } }>(key, '/mods/search', {
        gameId: MINECRAFT,
        classId: CF_CLASS[o.kind],
        searchFilter: o.query,
        gameVersion: o.gameVersion,
        // Plugins and modpacks are not tied to a loader type here.
        modLoaderType: o.kind === 'mod' ? cfLoaderType(o.loaders) : null,
        sortField: 2,
        sortOrder: 'desc',
        index: o.offset,
        pageSize: Math.min(o.pageSize, 50),
    });

    // CurseForge caps index + pageSize at 10 000.
    return { hits: data.data.map(cfToProject), total: Math.min(data.pagination.totalCount, 10_000) };
}

/** The newest file of a project for this version and loader, falling back to any version. */
export async function cfLatestFile(key: string, modId: string, gameVersion: string | null, loaders: readonly string[]): Promise<{ file: CfFile; exact: boolean }> {
    const list = (version: string | null) =>
        cf<{ data: CfFile[] }>(key, `/mods/${modId}/files`, { gameVersion: version, modLoaderType: cfLoaderType(loaders), pageSize: 20 });
    let files = (await list(gameVersion)).data.filter((f) => !f.isServerPack);
    const exact = files.length > 0;
    if (!exact && gameVersion) files = (await list(null)).data.filter((f) => !f.isServerPack);
    if (!files[0]) throw new Error('CurseForge has no file for this project.');
    return { file: files[0], exact };
}

export const cfFile = (key: string, modId: string, fileId: number) =>
    cf<{ data: CfFile }>(key, `/mods/${modId}/files/${fileId}`).then((r) => r.data);

/** A file's download, or an error naming its page when the author turned third-party downloads off. */
export function cfDownload(file: CfFile, page: string): { url: string; filename: string } {
    if (!file.downloadUrl) throw new Error(`The author only allows downloads from CurseForge itself: ${page}`);
    return { url: file.downloadUrl, filename: safeName(file.fileName) };
}
