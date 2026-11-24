import { useMemo, useState } from 'react';
import { ChevronDown, Search, Server as ServerIcon } from 'lucide-react';
import {
    Button,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    Spinner,
    Switch,
    cn,
    useCurrentUser,
} from '@pterodactyl/sdk';
import { Slot, View, type ServerListItem, type ViewProps } from '@pterodactyl/sdk/theme';
import { bytes, partOfDay } from '../lib/format';
import { useObsidian } from '../lib/settings';
import { usePins, useStored } from '../lib/storage';
import { useServersMeta } from '../lib/serverMeta';
import { usePlayerTotal } from '../lib/players';
import Collapse from '../ui/Collapse';

type Filter = 'all' | 'pinned' | 'running' | 'offline';

const power = (item: ServerListItem) => (item.state.kind === 'ready' ? item.state.power : null);

function Total({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className='obs-surface min-w-0 px-4 py-3.5 sm:px-5 sm:py-4'>
            <p className='obs-eyebrow'>{label}</p>
            <div className='obs-num mt-1.5 flex flex-wrap items-baseline gap-x-1 text-2xl font-bold tracking-tight whitespace-nowrap sm:text-3xl'>
                {children}
            </div>
        </div>
    );
}

function Totals({ servers, total }: { servers: readonly ServerListItem[]; total: number }) {
    const ready = servers.flatMap((s) => (s.state.kind === 'ready' ? [s.state] : []));
    const online = ready.filter((s) => s.power === 'running').length;
    const memory = ready.reduce((sum, s) => sum + s.memory.value, 0);
    const memoryLimit = ready.reduce((sum, s) => sum + s.memory.limit, 0);
    const cpu = ready.reduce((sum, s) => sum + s.cpu.value, 0);
    const players = usePlayerTotal(
        servers.map((s) => ({ address: s.address, running: s.state.kind === 'ready' && s.state.power === 'running' }))
    );

    return (
        <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
            <Total label='Servers'>{total}</Total>
            <Total label='Online'>
                <span className={online > 0 ? 'text-success' : ''}>{online}</span>
                <span className='text-sm font-medium text-muted-foreground'>/{servers.length}</span>
            </Total>
            {players ? (
                <Total label='Players now'>
                    {players.online}
                    {players.max > 0 && (
                        <span className='text-sm font-medium text-muted-foreground'>/{players.max}</span>
                    )}
                </Total>
            ) : (
                <Total label='CPU now'>
                    {cpu.toFixed(0)}
                    <span className='text-sm font-medium text-muted-foreground'>%</span>
                </Total>
            )}
            <Total label='Memory in use'>
                {bytes(memory)}
                {memoryLimit > 0 && (
                    <span className='ml-1 text-xs font-medium text-muted-foreground'>of {bytes(memoryLimit)}</span>
                )}
            </Total>
        </div>
    );
}

function Greeting({ servers }: { servers: readonly ServerListItem[] }) {
    const user = useCurrentUser();
    const { switcherKey } = useObsidian();
    const up = servers.filter((s) => power(s) === 'running').length;
    const part = partOfDay();

    return (
        <div className='mb-6'>
            <h1 className='font-header text-[2rem] leading-tight font-bold tracking-tight sm:text-[2.4rem]'>
                Good {part}, {user.username}
            </h1>
            <p className='mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground'>
                {servers.length === 0
                    ? 'No servers yet.'
                    : `${up} of ${servers.length} server${servers.length === 1 ? ' is' : 's are'} up.`}
                {switcherKey.trim() && !window.matchMedia?.('(pointer: coarse)').matches && (
                    <>
                        {' '}
                        Press <kbd className='obs-kbd'>{switcherKey.trim().toUpperCase()}</kbd> anywhere to switch
                        servers.
                    </>
                )}
            </p>
        </div>
    );
}

export default function ServerList({ model, className }: ViewProps<'dashboard.serverList'>) {
    const settings = useObsidian();
    const { isPinned } = usePins();
    const [filter, setFilter] = useState<Filter>('all');
    const [term, setTerm] = useState('');
    const others = model.scope === 'others';

    const shown = useMemo(() => {
        const needle = term.trim().toLowerCase();

        return model.servers.filter((item) => {
            const state = power(item);
            if (filter === 'pinned' && !isPinned(item.uuid)) return false;
            if (filter === 'running' && state !== 'running' && state !== 'starting') return false;
            if (filter === 'offline' && state !== 'offline' && item.state.kind !== 'unavailable') return false;

            return (
                !needle ||
                [item.name, item.address ?? '', item.description ?? '', item.identifier].some((v) =>
                    v.toLowerCase().includes(needle)
                )
            );
        });
    }, [model.servers, filter, term, isPinned]);

    const sorted = [...shown].sort((a, b) => Number(isPinned(b.uuid)) - Number(isPinned(a.uuid)));
    const meta = useServersMeta(model.servers.map((s) => s.identifier));
    const [collapsed, setCollapsed] = useStored<string[]>('dashboard-groups', []);
    const sections = useMemo(() => {
        const named = new Map<string, ServerListItem[]>();
        for (const item of sorted) {
            const group = meta[item.identifier]?.group?.trim() || '';
            named.set(group, [...(named.get(group) ?? []), item]);
        }

        return [...named.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
    }, [sorted, meta]);
    const grouped = sections.length > 1 || (sections[0] && sections[0][0] !== '');

    return (
        <div className={cn('flex flex-col gap-5', className)}>
            {settings.greeting && <Greeting servers={model.servers} />}
            {settings.dashboardStats && <Totals servers={model.servers} total={model.totals.servers} />}
            <Slot name='dashboard.before' />
            <div className='flex flex-wrap items-center gap-3'>
                <div
                    role='tablist'
                    aria-label='Filter servers'
                    className='flex rounded-full border border-border bg-card p-1'
                >
                    {(['all', 'pinned', 'running', 'offline'] as const).map((f) => (
                        <button
                            key={f}
                            type='button'
                            role='tab'
                            aria-selected={filter === f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                'rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition',
                                filter === f
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                {model.canViewOthers && (
                    <Switch
                        checked={others}
                        onChange={() => model.actions.setScope(others ? 'mine' : 'others')}
                        label="Other users' servers"
                        controlPosition='end'
                    />
                )}
                <label className='ml-auto flex h-10 w-full items-center gap-2 rounded-full border border-border bg-card px-4 sm:w-64'>
                    <Search className='size-4 text-muted-foreground' aria-hidden />
                    <input
                        value={term}
                        onChange={(event) => setTerm(event.target.value)}
                        placeholder='Find a server'
                        aria-label='Find a server'
                        className='h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0'
                    />
                </label>
            </div>
            {model.loading && <Spinner size='large' centered />}
            {!model.loading && sorted.length === 0 && (
                <Empty className='obs-surface py-12'>
                    <EmptyHeader>
                        <EmptyMedia variant='icon'>
                            <ServerIcon />
                        </EmptyMedia>
                        <EmptyTitle>{model.servers.length === 0 ? 'No servers yet' : 'Nothing matches'}</EmptyTitle>
                        <EmptyDescription>
                            {model.servers.length === 0
                                ? 'Servers you own or are invited to show up here.'
                                : 'Try another filter or search term.'}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
            {sections.map(([group, items]) => {
                const closed = grouped && collapsed.includes(group);
                return (
                    <section key={group || '_'} className='flex flex-col gap-2.5'>
                        {grouped && (
                            <button
                                type='button'
                                aria-expanded={!closed}
                                onClick={() =>
                                    setCollapsed(closed ? collapsed.filter((g) => g !== group) : [...collapsed, group])
                                }
                                className='obs-eyebrow group mt-1 flex items-center gap-2 self-start rounded-md py-1 hover:text-foreground'
                            >
                                <ChevronDown
                                    className={cn('size-3.5 transition', closed && '-rotate-90')}
                                    aria-hidden
                                />
                                {group || 'Ungrouped'}
                                <span className='rounded-full bg-muted px-1.5 py-0.5 text-[0.6rem] tracking-normal'>
                                    {items.length}
                                </span>
                            </button>
                        )}
                        <Collapse open={!closed}>
                            <ul className='obs-stagger flex flex-col gap-2.5'>
                                {items.map((item, i) => (
                                    <li key={item.uuid} className='min-w-0' style={{ '--i': i } as React.CSSProperties}>
                                        <Slot name='dashboard.serverRow.before' data={item.server} />
                                        <View name='dashboard.serverCard' server={item.server} />
                                        <Slot name='dashboard.serverRow.after' data={item.server} />
                                    </li>
                                ))}
                            </ul>
                        </Collapse>
                    </section>
                );
            })}
            {model.pagination && model.pagination.totalPages > 1 && (
                <nav
                    aria-label='Pages'
                    className='flex items-center justify-center gap-3 text-sm text-muted-foreground'
                >
                    <Button
                        size='xsmall'
                        color='grey'
                        disabled={model.pagination.currentPage === 1}
                        onClick={() => model.actions.setPage(model.pagination!.currentPage - 1)}
                    >
                        Previous
                    </Button>
                    {model.pagination.currentPage} of {model.pagination.totalPages}
                    <Button
                        size='xsmall'
                        color='grey'
                        disabled={model.pagination.currentPage === model.pagination.totalPages}
                        onClick={() => model.actions.setPage(model.pagination!.currentPage + 1)}
                    >
                        Next
                    </Button>
                </nav>
            )}
            <Slot name='dashboard.after' />
        </div>
    );
}
