import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@pterodactyl/sdk';

export interface ServerMeta {
    readonly [key: string]: unknown;
    readonly group?: string;
    readonly color?: string;

    readonly icon?: { readonly glyph: string; readonly tint?: string } | null;
    readonly note?: string;
}

export const META_FILE = '/.obsidian.json';

const key = (identifier: string) => ['obsidian', 'meta', identifier] as const;

async function readMeta(identifier: string): Promise<ServerMeta> {
    try {
        const { data } = await http.get<string>(`/api/client/servers/${identifier}/files/contents`, {
            params: { file: META_FILE },
            responseType: 'text',
            transformResponse: (raw) => raw,
        });
        const parsed = JSON.parse(data) as ServerMeta;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

const options = (identifier: string) => ({
    queryKey: key(identifier),
    queryFn: () => readMeta(identifier),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
});

export function useServerMeta(identifier: string | undefined): ServerMeta {
    return useQuery({ ...options(identifier ?? ''), enabled: !!identifier }).data ?? {};
}

export function useServersMeta(identifiers: readonly string[]): Record<string, ServerMeta> {
    const results = useQueries({ queries: identifiers.map((id) => options(id)) });
    return Object.fromEntries(identifiers.map((id, i) => [id, results[i]?.data ?? {}]));
}

export function useSaveServerMeta(identifier: string) {
    const client = useQueryClient();

    return async (meta: ServerMeta) => {
        const current = await readMeta(identifier);
        const clean = Object.fromEntries(
            Object.entries({ ...current, ...meta }).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
        await http.post(`/api/client/servers/${identifier}/files/write`, JSON.stringify(clean, null, 2) + '\n', {
            params: { file: META_FILE },
            headers: { 'Content-Type': 'text/plain' },
        });
        client.setQueryData(key(identifier), clean);
    };
}

export const TINTS = [
    '#6ee7a0',
    '#7aa2ff',
    '#f2b45a',
    '#c792ea',
    '#f0716b',
    '#6fd6e3',
    '#f59ec5',
    '#a3e635',
    '#fbbf24',
    '#94a3b8',
];

export function hash(value: string): number {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
    return Math.abs(h);
}

export const defaultTint = (uuid: string) => TINTS[hash(uuid) % TINTS.length];
