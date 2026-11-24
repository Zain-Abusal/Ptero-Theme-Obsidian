import { useQuery } from '@tanstack/react-query';
import { http, useServerResources, type SdkServer } from '@pterodactyl/sdk';
import type { ServerRunState } from '@pterodactyl/sdk/theme';

interface ServerListResponse {
    readonly data: SdkServer[];
}

/** Every server the user can open, for the switcher. The dashboard keeps its own paged list. */
export function useAllServers() {
    return useQuery({
        queryKey: ['obsidian', 'servers'],
        queryFn: async () => (await http.get<ServerListResponse>('/api/client', { params: { per_page: 100 } })).data.data,
        staleTime: 30_000,
    });
}

export interface LiveServer {
    readonly state: ServerRunState | null;
    readonly cpu: number;
    readonly memory: number;
    readonly disk: number;
    readonly uptime: number;
}

/** Live usage of one server, through the panel's own resources query. */
export function useLive(uuid: string | undefined): LiveServer | null {
    const { data } = useServerResources(uuid ?? '', (response) => response);
    if (!uuid || !data) return null;

    const attributes = (data as unknown as { attributes: { current_state: string; resources: Record<string, number> } })
        .attributes;
    const state = attributes.current_state === 'stopped' ? 'offline' : (attributes.current_state as ServerRunState);

    return {
        state,
        cpu: attributes.resources.cpu_absolute ?? 0,
        memory: attributes.resources.memory_bytes ?? 0,
        disk: attributes.resources.disk_bytes ?? 0,
        uptime: attributes.resources.uptime ?? 0,
    };
}

export type PowerSignal = 'start' | 'stop' | 'restart' | 'kill';

/** Sends a power signal through the client API, so it works without a console connection. */
export const sendPower = (identifier: string, signal: PowerSignal) =>
    http.post(`/api/client/servers/${identifier}/power`, { signal });

/** Whether the user holds a subuser permission on a server (owners and admins hold `*`). */
export function can(server: SdkServer, permission: string): boolean {
    const granted = server.meta?.user_permissions ?? [];
    const [group] = permission.split('.');

    return (
        server.attributes.server_owner ||
        granted.includes('*') ||
        granted.includes(permission) ||
        granted.includes(`${group}.*`)
    );
}

/** The primary allocation as "host:port". */
export function primaryAddress(server: SdkServer): string | null {
    const list = server.attributes.relationships?.allocations;
    const items = list && 'data' in list ? (list.data as { attributes: Record<string, unknown> }[]) : [];
    const primary = items.find((a) => a.attributes.is_default) ?? items[0];
    if (!primary) return null;

    const host = (primary.attributes.alias as string | null) || (primary.attributes.ip as string);
    return `${host}:${primary.attributes.port as number}`;
}
