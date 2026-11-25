import { afterEach, expect, test, vi } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));

vi.mock('@pterodactyl/sdk', () => ({ http }));

import {
    addAllocation,
    listAllocations,
    removeAllocation,
    setPrimaryAllocation,
    updateAllocationNotes,
} from './allocations';

afterEach(() => vi.clearAllMocks());

const resource = {
    attributes: {
        id: 17,
        ip: '127.0.0.1',
        ip_alias: 'node.example.test',
        port: 19132,
        notes: 'Geyser',
        is_default: false,
    },
};

test('maps panel allocations into the port manager model', async () => {
    http.get.mockResolvedValue({ data: { data: [resource] } });

    await expect(listAllocations('server-id')).resolves.toEqual([
        {
            id: 17,
            ip: '127.0.0.1',
            alias: 'node.example.test',
            port: 19132,
            notes: 'Geyser',
            primary: false,
        },
    ]);
    expect(http.get).toHaveBeenCalledWith('/api/client/servers/server-id/network/allocations');
});

test('adds, labels, promotes, and removes allocations through the client API', async () => {
    http.post.mockResolvedValue({ data: resource });

    await expect(addAllocation('server-id')).resolves.toMatchObject({ id: 17, port: 19132 });
    await updateAllocationNotes('server-id', 17, 'Query');
    await setPrimaryAllocation('server-id', 17);
    await removeAllocation('server-id', 17);

    expect(http.post).toHaveBeenNthCalledWith(1, '/api/client/servers/server-id/network/allocations');
    expect(http.post).toHaveBeenNthCalledWith(2, '/api/client/servers/server-id/network/allocations/17', {
        notes: 'Query',
    });
    expect(http.post).toHaveBeenNthCalledWith(3, '/api/client/servers/server-id/network/allocations/17/primary');
    expect(http.delete).toHaveBeenCalledWith('/api/client/servers/server-id/network/allocations/17');
});
