import { http } from '@pterodactyl/sdk';
import type { Entry, ServerApi } from './api';

/** Root folders that are never worlds, so detection does not list them. */
const NOT_WORLDS = new Set([
    'plugins', 'mods', 'config', 'logs', 'libraries', 'cache', 'versions', 'crash-reports', 'bundler', 'disabled-plugins',
    'defaultconfigs', 'kubejs', 'scripts', 'resourcepacks', 'shaderpacks', 'journeymap', 'backups', 'debug', 'local',
]);

/** At most this many folders are opened to look for level.dat. */
export const MAX_PROBES = 12;

export interface World {
    readonly name: string;
    /** Bukkit keeps the Nether and the End in their own folders beside the world. */
    readonly dimensions: string[];
}

/** The folders worth opening: likely world names first, never the known non-world folders. */
export function worldCandidates(root: readonly Entry[], levelName: string): string[] {
    const dirs = root.filter((e) => !e.isFile && !e.name.startsWith('.') && !NOT_WORLDS.has(e.name.toLowerCase())).map((e) => e.name);
    const score = (name: string) => (name === levelName ? 0 : /^world/i.test(name) ? 1 : /(_nether|_the_end)$/i.test(name) ? 2 : 3);

    return dirs.sort((a, b) => score(a) - score(b) || a.localeCompare(b)).slice(0, MAX_PROBES);
}

/** Groups "world", "world_nether" and "world_the_end" into one world. */
export function groupWorlds(withLevel: readonly string[]): World[] {
    const set = new Set(withLevel);
    const worlds: World[] = [];
    for (const name of withLevel) {
        const base = name.replace(/_(nether|the_end)$/i, '');
        if (base !== name && set.has(base)) continue;
        worlds.push({ name, dimensions: ['nether', 'the_end'].filter((d) => set.has(`${name}_${d}`)) });
    }
    return worlds;
}

/** Finds the worlds on the server, opening only a bounded number of folders. */
export async function findWorlds(api: ServerApi, levelName: string): Promise<World[]> {
    const root = await api.listOrEmpty('/');
    const candidates = worldCandidates(root, levelName);
    const hasLevel = await Promise.all(
        candidates.map(async (dir) => ((await api.listOrEmpty(`/${dir}`)).some((e) => e.name === 'level.dat') ? dir : null))
    );
    return groupWorlds(hasLevel.filter((d): d is string => d !== null));
}

/** Zips folders in the root; returns the archive's name. */
export async function compress(id: string, files: string[]): Promise<string> {
    const { data } = await http.post<{ attributes: { name: string } }>(`/api/client/servers/${id}/files/compress`, { root: '/', files });
    return data.attributes.name;
}

/** A one-time download link for a file. */
export async function downloadUrl(id: string, file: string): Promise<string> {
    const { data } = await http.get<{ attributes: { url: string } }>(`/api/client/servers/${id}/files/download`, { params: { file } });
    return data.attributes.url;
}

/** "world-old-2026-11-24" style names for a world set aside. */
export const asideName = (name: string, date = new Date()) => `${name}-old-${date.toISOString().slice(0, 10)}`;
