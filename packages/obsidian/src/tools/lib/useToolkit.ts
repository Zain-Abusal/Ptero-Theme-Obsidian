import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentServerRequired } from '@pterodactyl/sdk';
import { serverApi } from './api';
import { detect, loadersFor, type Installed } from './minecraft';

export function useToolkit() {
    const server = useCurrentServerRequired();
    const id = server.attributes.identifier;
    const api = useMemo(() => serverApi(id), [id]);
    const client = useQueryClient();
    const installed = useQuery({
        queryKey: ['obsidian-mc', id, 'installed'],
        queryFn: () => detect(api),
        staleTime: 60_000,
    });
    const software = installed.data?.software ?? 'unknown';

    return {
        server,
        id,
        api,
        installed: installed.data as Installed | undefined,
        loading: installed.isLoading,
        loaders: loadersFor(software),
        gameVersion: installed.data?.version ?? null,
        refresh: () => client.invalidateQueries({ queryKey: ['obsidian-mc', id] }),
    };
}

export function useDirectory(directory: string) {
    const { id, api } = useToolkit();

    return useQuery({
        queryKey: ['obsidian-mc', id, 'dir', directory],
        queryFn: () => api.listOrEmpty(directory),
        staleTime: 10_000,
    });
}
