import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, ChevronDown, Copy, LayoutGrid, Pin, Play, Search, Square, TerminalSquare } from 'lucide-react';
import { Button, Spinner, cn, toast, usePanelNavigate, useShortcut, type SdkServer } from '@pterodactyl/sdk';
import type { AppArea } from '@pterodactyl/sdk/theme';
import { bytes, stateLabel, stateTone } from '../lib/format';
import { can, primaryAddress, sendPower, useAllServers, useLive } from '../lib/servers';
import { useObsidian } from '../lib/settings';
import { usePins, useRecent } from '../lib/storage';
import ServerIcon from '../lib/serverIcon';
import StatusDot from '../ui/StatusDot';

function Tile({ label, value, fill }: { label: string; value: string; fill?: number | null }) {
    return (
        <div className='relative overflow-hidden rounded-lg border border-border bg-muted/50 px-3 py-2.5'>
            <p className='obs-eyebrow text-[0.6rem]'>{label}</p>
            <p className='obs-num mt-0.5 text-lg font-bold tracking-tight'>{value}</p>
            {fill !== undefined && fill !== null && (
                <span
                    className='absolute bottom-0 left-3 h-0.5 rounded-full bg-success'
                    style={{ width: `calc(${Math.min(fill, 1) * 100}% - 1.5rem)` }}
                />
            )}
        </div>
    );
}

/** The selected server: live usage, its address and what the user may do with it. */
function Preview({ server, onOpen }: { server: SdkServer; onOpen: (to: 'console' | 'files') => void }) {
    const live = useLive(server.attributes.uuid);
    const address = primaryAddress(server);
    const memoryLimit = server.attributes.limits.memory * 1024 * 1024;
    const running = live?.state === 'running' || live?.state === 'starting';

    const power = (signal: 'start' | 'stop') =>
        sendPower(server.attributes.identifier, signal).catch(() => toast.error(`Could not ${signal} the server.`));

    return (
        <div className='flex min-w-0 flex-col gap-4 p-5'>
            <div className='flex items-center gap-3'>
                <ServerIcon identifier={server.attributes.identifier} uuid={server.attributes.uuid} size={52} />
                <div className='min-w-0'>
                    <p className='truncate text-xl font-bold tracking-tight'>{server.attributes.name}</p>
                    <p className='obs-eyebrow mt-1 flex items-center gap-1.5 text-[0.65rem]'>
                        <StatusDot tone={stateTone(live?.state)} />
                        <span className={live?.state === 'running' ? 'text-success' : ''}>
                            {live?.state ? stateLabel[live.state] : 'Checking'}
                        </span>
                        <span className='font-mono normal-case tracking-normal'>{server.attributes.node}</span>
                    </p>
                </div>
            </div>
            {server.attributes.description && (
                <p className='line-clamp-2 text-sm text-muted-foreground'>{server.attributes.description}</p>
            )}
            <div className='grid grid-cols-3 gap-2'>
                <Tile label='CPU' value={live ? `${live.cpu.toFixed(0)}%` : '…'} />
                <Tile
                    label='Memory'
                    value={live ? bytes(live.memory) : '…'}
                    fill={live && memoryLimit > 0 ? live.memory / memoryLimit : null}
                />
                <Tile label='Disk' value={live ? bytes(live.disk) : '…'} />
            </div>
            {address && (
                <button
                    type='button'
                    onClick={() =>
                        navigator.clipboard?.writeText(address).then(() => toast.success('Address copied.'))
                    }
                    className='flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-left font-mono text-sm hover:bg-muted'
                >
                    <span className='min-w-0 flex-1 truncate'>{address}</span>
                    <span className='flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-sans text-xs text-muted-foreground'>
                        <Copy className='size-3' aria-hidden /> Copy
                    </span>
                </button>
            )}
            <div className='flex flex-wrap gap-2'>
                <Button className='flex-1' onClick={() => onOpen('console')}>
                    Open <ArrowRight className='size-4' aria-hidden />
                </Button>
                <Button color='grey' onClick={() => onOpen('files')}>
                    <TerminalSquare className='size-4' aria-hidden /> Files
                </Button>
                {running
                    ? can(server, 'control.stop') && (
                          <Button color='red' onClick={() => power('stop')}>
                              <Square className='size-3.5' aria-hidden /> Stop
                          </Button>
                      )
                    : can(server, 'control.start') && (
                          <Button color='green' onClick={() => power('start')}>
                              <Play className='size-3.5' aria-hidden /> Start
                          </Button>
                      )}
            </div>
        </div>
    );
}

/**
 * The server switcher: a pill naming where you are that opens a palette of every server, recent and
 * pinned first, with a live preview of the one under the cursor. Its key (S by default) opens it
 * anywhere, and [ and ] step through servers while inside one.
 */
export default function Switcher({ area }: { area: AppArea }) {
    const settings = useObsidian();
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const [index, setIndex] = useState(0);
    const panel = useRef<HTMLDivElement>(null);
    const navigate = usePanelNavigate();
    const { data: servers, isLoading } = useAllServers();
    const { recent } = useRecent();
    const { isPinned, toggle } = usePins();

    const ordered = useMemo(() => {
        const all = servers ?? [];
        const rank = (s: SdkServer) => {
            const r = recent.indexOf(s.attributes.identifier);
            return (isPinned(s.attributes.uuid) ? -1000 : 0) + (r === -1 ? 500 : r);
        };
        const needle = term.trim().toLowerCase();

        return all
            .filter(
                (s) =>
                    !needle ||
                    s.attributes.name.toLowerCase().includes(needle) ||
                    (primaryAddress(s) ?? '').toLowerCase().includes(needle)
            )
            .sort((a, b) => rank(a) - rank(b) || a.attributes.name.localeCompare(b.attributes.name));
    }, [servers, recent, term, isPinned]);

    const selected = ordered[Math.min(index, ordered.length - 1)];

    const go = (server: SdkServer, to: 'console' | 'files' = 'console') => {
        setOpen(false);
        void navigate(
            to === 'files'
                ? { to: '/server/$id/files', params: { id: server.attributes.identifier } }
                : { to: '/server/$id', params: { id: server.attributes.identifier } }
        );
    };

    const key = settings.switcherKey.trim().toLowerCase();
    const shortcut = useShortcut(key || 's', () => setOpen(true), { when: key !== '' && !open });

    // [ and ] step to the previous and next server while inside one.
    const step = (by: number) => {
        if (area.kind !== 'server' || !servers?.length) return;
        const sorted = [...servers].sort((a, b) => a.attributes.name.localeCompare(b.attributes.name));
        const at = sorted.findIndex((s) => s.attributes.identifier === area.identifier);
        go(sorted[(at + by + sorted.length) % sorted.length]);
    };
    useShortcut('[', () => step(-1), { when: area.kind === 'server' });
    useShortcut(']', () => step(1), { when: area.kind === 'server' });

    useEffect(() => {
        if (!open) return;
        setIndex(0);
        setTerm('');
        const close = (event: MouseEvent) => {
            if (panel.current && !panel.current.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false);
        else if (event.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, ordered.length - 1));
        else if (event.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
        else if (event.key === 'Enter' && selected) go(selected);
        else if (event.key.toLowerCase() === 'p' && (event.altKey || event.target === event.currentTarget) && selected)
            toggle(selected.attributes.uuid);
        else return;
        event.preventDefault();
    };

    const here = area.kind === 'server' ? area : null;

    return (
        <div className='relative min-w-0' ref={panel}>
            <button
                type='button'
                aria-expanded={open}
                aria-haspopup='dialog'
                aria-keyshortcuts={key ? shortcut.aria : undefined}
                onClick={() => setOpen(!open)}
                className='flex h-10 max-w-[16rem] items-center gap-2.5 rounded-full border border-border bg-card/80 pr-3 pl-1.5 text-sm font-semibold transition hover:bg-muted'
            >
                {here ? (
                    <ServerIcon identifier={here.identifier} uuid={here.uuid} size={28} className='rounded-full' />
                ) : (
                    <span className='grid size-7 place-items-center rounded-full bg-muted text-muted-foreground'>
                        <LayoutGrid className='size-3.5' aria-hidden />
                    </span>
                )}
                <span className='truncate'>{here ? here.name : 'All servers'}</span>
                <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition', open && 'rotate-180')} />
            </button>
            {open && (
                <div
                    role='dialog'
                    aria-label='Switch server'
                    onKeyDown={onKeyDown}
                    className='fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl sm:absolute sm:inset-x-auto sm:top-12 sm:left-0 sm:w-[min(46rem,calc(100vw-2rem))]'
                >
                    <div className='flex items-center gap-3 border-b border-border px-4'>
                        <Search className='size-4 text-muted-foreground' aria-hidden />
                        <input
                            autoFocus
                            value={term}
                            onChange={(event) => {
                                setTerm(event.target.value);
                                setIndex(0);
                            }}
                            placeholder='Jump to a server…'
                            aria-label='Search servers'
                            className='h-12 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0'
                        />
                        <kbd className='obs-kbd'>Esc</kbd>
                    </div>
                    <div className='grid sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]'>
                        <div className='max-h-80 overflow-y-auto border-border p-2 sm:max-h-[22rem] sm:border-r'>
                            <p className='obs-eyebrow px-2 pt-1 pb-2 text-[0.6rem]'>Recent first</p>
                            {isLoading && <Spinner size='small' centered />}
                            {!isLoading && ordered.length === 0 && (
                                <p className='px-2 py-6 text-center text-sm text-muted-foreground'>No servers match.</p>
                            )}
                            <ul role='listbox' aria-label='Servers'>
                                {ordered.map((server, i) => (
                                    <li key={server.attributes.uuid} role='option' aria-selected={server === selected}>
                                        <div
                                            className={cn(
                                                'group flex items-center gap-2.5 rounded-lg p-2 text-left',
                                                server === selected ? 'bg-muted' : 'hover:bg-muted/60'
                                            )}
                                            onMouseEnter={() => setIndex(i)}
                                        >
                                            <button
                                                type='button'
                                                onClick={() => go(server)}
                                                className='flex min-w-0 flex-1 items-center gap-2.5 text-left'
                                            >
                                                <ServerIcon
                                                    identifier={server.attributes.identifier}
                                                    uuid={server.attributes.uuid}
                                                    size={30}
                                                />
                                                <span className='min-w-0'>
                                                    <span className='block truncate text-sm font-semibold'>
                                                        {server.attributes.name}
                                                    </span>
                                                    <span className='block truncate font-mono text-[0.68rem] text-muted-foreground'>
                                                        {primaryAddress(server) ?? server.attributes.node}
                                                    </span>
                                                </span>
                                            </button>
                                            <button
                                                type='button'
                                                aria-label={isPinned(server.attributes.uuid) ? 'Unpin' : 'Pin'}
                                                aria-pressed={isPinned(server.attributes.uuid)}
                                                onClick={() => toggle(server.attributes.uuid)}
                                                className={cn(
                                                    'grid size-6 place-items-center rounded-md text-muted-foreground hover:text-foreground',
                                                    isPinned(server.attributes.uuid)
                                                        ? 'text-foreground'
                                                        : 'opacity-0 group-hover:opacity-100'
                                                )}
                                            >
                                                <Pin
                                                    className={cn('size-3.5', isPinned(server.attributes.uuid) && 'fill-current')}
                                                    aria-hidden
                                                />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className='hidden sm:block'>
                            {selected ? (
                                <Preview server={selected} onOpen={(to) => go(selected, to)} />
                            ) : (
                                <p className='p-8 text-center text-sm text-muted-foreground'>Pick a server to preview it.</p>
                            )}
                        </div>
                    </div>
                    <div className='hidden items-center gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:flex'>
                        <span className='flex items-center gap-1.5'>
                            <kbd className='obs-kbd'>↑</kbd>
                            <kbd className='obs-kbd'>↓</kbd> Move
                        </span>
                        <span className='flex items-center gap-1.5'>
                            <kbd className='obs-kbd'>↵</kbd> Open
                        </span>
                        <span className='flex items-center gap-1.5'>
                            <kbd className='obs-kbd'>Alt</kbd>
                            <kbd className='obs-kbd'>P</kbd> Pin
                        </span>
                        <span className='flex items-center gap-1.5'>
                            <kbd className='obs-kbd'>[</kbd>
                            <kbd className='obs-kbd'>]</kbd> Prev / next
                        </span>
                        <button
                            type='button'
                            onClick={() => {
                                setOpen(false);
                                void navigate({ to: '/' });
                            }}
                            className='ml-auto flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-semibold text-foreground hover:bg-muted'
                        >
                            All servers <ArrowRight className='size-3.5' aria-hidden />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
