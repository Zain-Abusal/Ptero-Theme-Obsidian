import { useState } from 'react';
import { Check, Copy, Network, Pencil, Plus, Server, Star, Trash2, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Badge,
    Button,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    Spinner,
    toast,
    useServerPermission,
} from '@pterodactyl/sdk';
import {
    listAllocations,
    addAllocation,
    updateAllocationNotes,
    setPrimaryAllocation,
    removeAllocation,
} from '../../ops/allocations';
import type { Allocation } from '../../ops/allocations';
import { useToolkit } from '../lib/useToolkit';
import Page, { Panel, attempt } from '../ui/Page';

function address(allocation: Allocation) {
    return `${allocation.alias || allocation.ip}:${allocation.port}`;
}

export default function PortsScreen() {
    const { id } = useToolkit();
    const client = useQueryClient();
    const canRead = useServerPermission('allocation.read');
    const canCreate = useServerPermission('allocation.create');
    const canUpdate = useServerPermission('allocation.update');
    const canDelete = useServerPermission('allocation.delete');
    const [busy, setBusy] = useState<number | 'add' | null>(null);
    const [editing, setEditing] = useState<number | null>(null);
    const [draft, setDraft] = useState('');
    const key = ['obsidian-ops', id, 'allocations'];
    const query = useQuery({ queryKey: key, queryFn: () => listAllocations(id), enabled: canRead });
    const refresh = () => client.invalidateQueries({ queryKey: key });

    const act = async (task: number | 'add', work: () => Promise<unknown>, success: string) => {
        setBusy(task);
        await attempt(work, success, toast);
        await refresh();
        setBusy(null);
    };

    const saveNotes = async (allocation: Allocation) => {
        setBusy(allocation.id);
        const ok = await attempt(
            () => updateAllocationNotes(id, allocation.id, draft.trim()).then(() => true),
            'Port label saved.',
            toast
        );
        if (ok !== undefined) setEditing(null);
        await refresh();
        setBusy(null);
    };

    const remove = async (allocation: Allocation) => {
        if (allocation.primary || !window.confirm(`Remove ${address(allocation)} from this server?`)) return;
        await act(allocation.id, () => removeAllocation(id, allocation.id), 'Port removed.');
    };

    const copy = async (allocation: Allocation) => {
        try {
            await navigator.clipboard.writeText(address(allocation));
            toast.success('Address copied.');
        } catch {
            toast.error('Could not copy the address.');
        }
    };

    const allocations = [...(query.data ?? [])].sort((a, b) => Number(b.primary) - Number(a.primary));

    return (
        <Page
            title='Ports'
            description='Label and manage this server’s network allocations for game and service ports.'
            actions={
                canCreate && (
                    <Button
                        onClick={() => void act('add', () => addAllocation(id), 'Port added.')}
                        isLoading={busy === 'add'}
                        disabled={busy !== null}
                    >
                        <Plus className='size-4' aria-hidden /> Add port
                    </Button>
                )
            }
        >
            <Alert type='info'>
                The panel assigns an available port from the node. Add a label such as Votifier, Geyser, BlueMap,
                Dynmap, Query or RCON, then use that address in the service settings.
            </Alert>
            {!canRead ? (
                <Alert type='warning'>You need the allocation read permission to view this server’s ports.</Alert>
            ) : query.isLoading ? (
                <Spinner size='large' centered />
            ) : query.isError ? (
                <Alert type='warning'>
                    Could not load allocations. Check your allocation permissions and try again.
                </Alert>
            ) : allocations.length === 0 ? (
                <Empty className='rounded-xl border border-border py-10'>
                    <EmptyHeader>
                        <EmptyMedia variant='icon'>
                            <Network aria-hidden />
                        </EmptyMedia>
                        <EmptyTitle>No ports are assigned</EmptyTitle>
                        <EmptyDescription>
                            Ask an administrator to assign an allocation to this server.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <Panel
                    title='Server allocations'
                    aside={
                        <Badge tone='neutral' variant='soft'>
                            {allocations.length} port{allocations.length === 1 ? '' : 's'}
                        </Badge>
                    }
                >
                    <div className='flex flex-col divide-y divide-border'>
                        {allocations.map((allocation) => (
                            <div
                                key={allocation.id}
                                className='grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'
                            >
                                <div className='flex min-w-0 items-start gap-3'>
                                    <span className='grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-muted'>
                                        <Server className='size-4 text-muted-foreground' aria-hidden />
                                    </span>
                                    <div className='min-w-0 flex-1'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <code className='font-mono text-sm font-semibold'>
                                                {address(allocation)}
                                            </code>
                                            {allocation.primary && (
                                                <Badge tone='success' variant='soft'>
                                                    Primary
                                                </Badge>
                                            )}
                                        </div>
                                        {editing === allocation.id ? (
                                            <div className='mt-2 flex flex-wrap gap-2'>
                                                <input
                                                    value={draft}
                                                    onChange={(event) => setDraft(event.currentTarget.value)}
                                                    maxLength={256}
                                                    aria-label={`Label for ${address(allocation)}`}
                                                    placeholder='Service label'
                                                    className='h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary'
                                                />
                                                <Button
                                                    size='xsmall'
                                                    onClick={() => void saveNotes(allocation)}
                                                    isLoading={busy === allocation.id}
                                                >
                                                    <Check className='size-3.5' aria-hidden /> Save
                                                </Button>
                                                <Button size='xsmall' color='grey' onClick={() => setEditing(null)}>
                                                    <X className='size-3.5' aria-hidden /> Cancel
                                                </Button>
                                            </div>
                                        ) : (
                                            <p className='mt-1 truncate text-xs text-muted-foreground'>
                                                {allocation.notes || 'No service label'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className='flex flex-wrap items-center gap-1 sm:justify-end'>
                                    <Button size='xsmall' color='grey' onClick={() => void copy(allocation)}>
                                        <Copy className='size-3.5' aria-hidden /> Copy
                                    </Button>
                                    {canUpdate && editing !== allocation.id && (
                                        <Button
                                            size='xsmall'
                                            color='grey'
                                            onClick={() => {
                                                setDraft(allocation.notes ?? '');
                                                setEditing(allocation.id);
                                            }}
                                        >
                                            <Pencil className='size-3.5' aria-hidden /> Label
                                        </Button>
                                    )}
                                    {canUpdate && !allocation.primary && (
                                        <Button
                                            size='xsmall'
                                            color='grey'
                                            disabled={busy !== null}
                                            onClick={() =>
                                                void act(
                                                    allocation.id,
                                                    () => setPrimaryAllocation(id, allocation.id),
                                                    'Primary port updated.'
                                                )
                                            }
                                        >
                                            <Star className='size-3.5' aria-hidden /> Set primary
                                        </Button>
                                    )}
                                    {canDelete && !allocation.primary && (
                                        <Button
                                            size='xsmall'
                                            color='grey'
                                            disabled={busy !== null}
                                            aria-label={`Remove ${address(allocation)}`}
                                            onClick={() => void remove(allocation)}
                                        >
                                            <Trash2 className='size-3.5' aria-hidden />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>
            )}
        </Page>
    );
}
