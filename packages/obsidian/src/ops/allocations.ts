import { http } from '@pterodactyl/sdk';

export interface Allocation {
    readonly id: number;
    readonly ip: string;
    readonly alias: string | null;
    readonly port: number;
    readonly notes: string | null;
    readonly primary: boolean;
}

interface AllocationResource {
    readonly attributes: {
        readonly id: number;
        readonly ip: string;
        readonly ip_alias: string | null;
        readonly port: number;
        readonly notes: string | null;
        readonly is_default: boolean;
    };
}

const base = (id: string) => `/api/client/servers/${id}/network/allocations`;

const fromResource = ({ attributes: a }: AllocationResource): Allocation => ({
    id: a.id,
    ip: a.ip,
    alias: a.ip_alias,
    port: a.port,
    notes: a.notes,
    primary: a.is_default,
});

export async function listAllocations(id: string): Promise<Allocation[]> {
    const { data } = await http.get<{ data: AllocationResource[] }>(base(id));
    return data.data.map(fromResource);
}

export async function addAllocation(id: string): Promise<Allocation> {
    const { data } = await http.post<AllocationResource>(base(id));
    return fromResource(data);
}

export async function updateAllocationNotes(id: string, allocationId: number, notes: string): Promise<void> {
    await http.post(`${base(id)}/${allocationId}`, { notes: notes || null });
}

export async function setPrimaryAllocation(id: string, allocationId: number): Promise<void> {
    await http.post(`${base(id)}/${allocationId}/primary`);
}

export async function removeAllocation(id: string, allocationId: number): Promise<void> {
    await http.delete(`${base(id)}/${allocationId}`);
}
