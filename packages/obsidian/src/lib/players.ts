import { useQueries, useQuery } from '@tanstack/react-query';
import { useObsidian } from './settings';

export interface PlayerCount {
    readonly online: number;
    readonly max: number;
}

/** Private, loopback and link-local hosts that a public lookup service could never reach. */
export function isPublicAddress(address: string | null | undefined): address is string {
    if (!address) return false;
    const host = address.replace(/:\d+$/, '').toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isInteger(n))) {
        const [a, b] = parts;
        if (a === 10 || a === 127 || a === 0) return false;
        if (a === 192 && b === 168) return false;
        if (a === 172 && b >= 16 && b <= 31) return false;
        if (a === 169 && b === 254) return false;
        if (a === 100 && b >= 64 && b <= 127) return false;
    }
    return true;
}

/**
 * Players online on a server, from the public mcsrvstat.us lookup of its public address. Refreshed every
 * minute while the page is visible; off when the "Live player counts" setting is off or the server is
 * not running. Only the address leaves the panel.
 */
export function usePlayerCount(address: string | null | undefined, running: boolean): PlayerCount | null {
    const { livePlayers } = useObsidian();
    const enabled = livePlayers && running && isPublicAddress(address);
    const { data } = useQuery({
        queryKey: ['obsidian', 'players', address],
        queryFn: async (): Promise<PlayerCount | null> => {
            const response = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(address!)}`);
            if (!response.ok) return null;
            const body = (await response.json()) as { online?: boolean; players?: { online?: number; max?: number } };
            return body.online && body.players ? { online: body.players.online ?? 0, max: body.players.max ?? 0 } : null;
        },
        enabled,
        staleTime: 60_000,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
        retry: false,
    });

    return enabled ? (data ?? null) : null;
}

/** Players across running servers, sharing each row's cached lookup. Null when the setting is off. */
export function usePlayerTotal(servers: readonly { address: string | null; running: boolean }[]): PlayerCount | null {
    const { livePlayers } = useObsidian();
    const targets = servers.filter((s) => s.running && isPublicAddress(s.address));
    const results = useQueries({
        queries: targets.map((s) => ({
            queryKey: ['obsidian', 'players', s.address],
            queryFn: async (): Promise<PlayerCount | null> => {
                const response = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(s.address!)}`);
                if (!response.ok) return null;
                const body = (await response.json()) as { online?: boolean; players?: { online?: number; max?: number } };
                return body.online && body.players ? { online: body.players.online ?? 0, max: body.players.max ?? 0 } : null;
            },
            enabled: livePlayers,
            staleTime: 60_000,
            retry: false,
        })),
    });
    if (!livePlayers) return null;

    return results.reduce<PlayerCount>(
        (sum, r) => ({ online: sum.online + (r.data?.online ?? 0), max: sum.max + (r.data?.max ?? 0) }),
        { online: 0, max: 0 }
    );
}
