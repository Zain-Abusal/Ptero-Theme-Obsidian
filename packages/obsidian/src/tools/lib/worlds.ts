import { http } from '@pterodactyl/sdk';
import type { Entry, ServerApi } from './api';

const NOT_WORLDS = new Set([
    'plugins',
    'mods',
    'config',
    'logs',
    'libraries',
    'cache',
    'versions',
    'crash-reports',
    'bundler',
    'disabled-plugins',
    'defaultconfigs',
    'kubejs',
    'scripts',
    'resourcepacks',
    'shaderpacks',
    'journeymap',
    'backups',
    'debug',
    'local',
]);

export const MAX_PROBES = 12;

export interface World {
    readonly name: string;

    readonly dimensions: string[];
}

export function worldCandidates(root: readonly Entry[], levelName: string): string[] {
    const dirs = root
        .filter((e) => !e.isFile && !e.name.startsWith('.') && !NOT_WORLDS.has(e.name.toLowerCase()))
        .map((e) => e.name);
    const score = (name: string) =>
        name === levelName ? 0 : /^world/i.test(name) ? 1 : /(_nether|_the_end)$/i.test(name) ? 2 : 3;

    return dirs.sort((a, b) => score(a) - score(b) || a.localeCompare(b)).slice(0, MAX_PROBES);
}

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

export async function findWorlds(api: ServerApi, levelName: string): Promise<World[]> {
    const root = await api.listOrEmpty('/');
    const candidates = worldCandidates(root, levelName);
    const hasLevel = await Promise.all(
        candidates.map(async (dir) =>
            (await api.listOrEmpty(`/${dir}`)).some((e) => e.name === 'level.dat') ? dir : null
        )
    );
    return groupWorlds(hasLevel.filter((d): d is string => d !== null));
}

export async function compress(id: string, files: string[]): Promise<string> {
    const { data } = await http.post<{ attributes: { name: string } }>(`/api/client/servers/${id}/files/compress`, {
        root: '/',
        files,
    });
    return data.attributes.name;
}

export async function downloadUrl(id: string, file: string): Promise<string> {
    const { data } = await http.get<{ attributes: { url: string } }>(`/api/client/servers/${id}/files/download`, {
        params: { file },
    });
    return data.attributes.url;
}

export const asideName = (name: string, date = new Date()) => `${name}-old-${date.toISOString().slice(0, 10)}`;
