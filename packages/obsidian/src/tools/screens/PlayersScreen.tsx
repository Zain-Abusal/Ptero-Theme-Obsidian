import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Crown, ListChecks, LogOut, RefreshCw, ShieldOff, UserMinus, UserPlus, Users } from 'lucide-react';
import {
    Button,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    Tooltip,
    cn,
    toast,
    useServerPermission,
    useServerWebsocketEvent,
} from '@pterodactyl/sdk';
import { useToolkit } from '../lib/useToolkit';
import Page, { Segmented } from '../ui/Page';

type Tab = 'online' | 'whitelist' | 'ops' | 'banned' | 'known';

interface Listed {
    readonly name: string;
    readonly note?: string;
}

/** Minecraft's colour codes and ANSI escapes, which console lines carry. */
const plain = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, '').replace(/§./g, '');

/**
 * Reads the answer to `list`: "There are 2 of a max of 20 players online: Alex, Steve", or the older
 * "There are 2/20 players online:" with the names on the next line.
 */
export function parseList(line: string): { online: number; max: number; names: string[] | null } | null {
    const text = plain(line);
    const match = /There are (\d+)(?: of a max of |\/)(\d+) players online:?\s*(.*)$/i.exec(text);
    if (!match) return null;
    const rest = match[3].trim();
    const names = rest ? rest.split(/,\s*/).map((n) => n.replace(/^\[[^\]]*\]\s*/, '').trim()).filter(Boolean) : null;
    return { online: Number(match[1]), max: Number(match[2]), names: names ?? (Number(match[1]) === 0 ? [] : null) };
}

const head = (name: string) => `https://mc-heads.net/avatar/${encodeURIComponent(name)}/40`;

function useJsonList(file: string, map: (entry: Record<string, unknown>) => Listed) {
    const { id, api } = useToolkit();
    return useQuery({
        queryKey: ['obsidian-mc', id, 'json', file],
        queryFn: async () => {
            const raw = await api.readOrNull(file);
            try {
                return raw ? (JSON.parse(raw) as Record<string, unknown>[]).map(map) : [];
            } catch {
                return [];
            }
        },
        staleTime: 15_000,
    });
}

/** Online players, the whitelist, operators, bans and everyone who has joined, with the commands for each. */
export default function PlayersScreen() {
    const { id, api } = useToolkit();
    const client = useQueryClient();
    const canConsole = useServerPermission('control.console');
    const [tab, setTab] = useState<Tab>('online');
    const [online, setOnline] = useState<{ names: string[]; max: number } | null>(null);
    const [name, setName] = useState('');
    const waitingNames = useRef(false);

    const whitelist = useJsonList('/whitelist.json', (e) => ({ name: String(e.name) }));
    const ops = useJsonList('/ops.json', (e) => ({ name: String(e.name), note: `Level ${String(e.level ?? 4)}` }));
    const banned = useJsonList('/banned-players.json', (e) => ({ name: String(e.name), note: e.reason ? String(e.reason) : undefined }));
    const known = useJsonList('/usercache.json', (e) => ({ name: String(e.name) }));

    useServerWebsocketEvent('console output', (line) => {
        if (waitingNames.current) {
            waitingNames.current = false;
            const names = plain(line).replace(/^\[[^\]]*\]:?\s*/, '').split(/,\s*/).filter(Boolean);
            setOnline((o) => (o ? { ...o, names } : o));
            return;
        }
        const parsed = parseList(line);
        if (!parsed) return;
        setOnline({ names: parsed.names ?? [], max: parsed.max });
        waitingNames.current = parsed.names === null;
    });

    const refreshOnline = useCallback(() => {
        if (canConsole) void api.command('list').catch(() => undefined);
    }, [api, canConsole]);

    useEffect(() => {
        refreshOnline();
        const timer = window.setInterval(refreshOnline, 30_000);
        return () => window.clearInterval(timer);
    }, [refreshOnline]);

    const run = async (command: string, done: string) => {
        try {
            await api.command(command);
            toast.success(done);
            // Minecraft rewrites its JSON lists a moment after the command.
            window.setTimeout(() => {
                void client.invalidateQueries({ queryKey: ['obsidian-mc', id, 'json'] });
                refreshOnline();
            }, 1200);
        } catch {
            toast.error('The server must be running to do that.');
        }
    };

    const lists: Record<Tab, Listed[]> = {
        online: (online?.names ?? []).map((n) => ({ name: n })),
        whitelist: whitelist.data ?? [],
        ops: ops.data ?? [],
        banned: banned.data ?? [],
        known: known.data ?? [],
    };
    const opNames = new Set(lists.ops.map((p) => p.name.toLowerCase()));
    const listed = new Set(lists.whitelist.map((p) => p.name.toLowerCase()));

    const action = (icon: typeof Ban, label: string, onClick: () => void, danger = false) => {
        const Glyph = icon;
        return (
            <Tooltip content={label} key={label}>
                <button
                    type='button'
                    aria-label={label}
                    disabled={!canConsole}
                    onClick={onClick}
                    className={cn(
                        'grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted disabled:opacity-40',
                        danger ? 'hover:text-destructive' : 'hover:text-foreground'
                    )}
                >
                    <Glyph className='size-3.5' aria-hidden />
                </button>
            </Tooltip>
        );
    };

    const actionsFor = (p: Listed) => {
        const n = p.name;
        if (tab === 'banned') return [action(ShieldOff, `Pardon ${n}`, () => run(`pardon ${n}`, `Pardoned ${n}.`))];
        const out = [];
        if (tab === 'online') out.push(action(LogOut, `Kick ${n}`, () => run(`kick ${n}`, `Kicked ${n}.`), true));
        out.push(
            opNames.has(n.toLowerCase())
                ? action(Crown, `Remove operator ${n}`, () => run(`deop ${n}`, `${n} is no longer an operator.`))
                : action(Crown, `Make ${n} an operator`, () => run(`op ${n}`, `${n} is now an operator.`))
        );
        out.push(
            listed.has(n.toLowerCase())
                ? action(UserMinus, `Remove ${n} from the whitelist`, () => run(`whitelist remove ${n}`, `Removed ${n} from the whitelist.`))
                : action(UserPlus, `Whitelist ${n}`, () => run(`whitelist add ${n}`, `Whitelisted ${n}.`))
        );
        out.push(action(Ban, `Ban ${n}`, () => run(`ban ${n}`, `Banned ${n}.`), true));
        return out;
    };

    const people = lists[tab];
    const valid = /^[A-Za-z0-9_]{3,16}$/.test(name);

    return (
        <Page
            title='Players'
            description='Who is online, who can join, and who runs the place.'
            actions={
                <Button color='grey' onClick={refreshOnline} disabled={!canConsole}>
                    <RefreshCw className='size-4' aria-hidden /> Refresh
                </Button>
            }
        >
            <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                {[
                    ['Online now', online ? `${online.names.length}` : '—', online ? `/${online.max}` : ''],
                    ['Whitelisted', String(lists.whitelist.length), ''],
                    ['Operators', String(lists.ops.length), ''],
                    ['Banned', String(lists.banned.length), ''],
                ].map(([label, value, suffix]) => (
                    <div key={label} className='rounded-xl border border-border bg-card px-5 py-4'>
                        <p className='text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase'>{label}</p>
                        <p className='mt-1 text-3xl font-bold tabular-nums'>
                            {value}
                            <span className='text-sm font-medium text-muted-foreground'>{suffix}</span>
                        </p>
                    </div>
                ))}
            </div>

            <div className='flex flex-wrap items-center gap-3'>
                <Segmented
                    label='Lists'
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'online', label: 'Online' },
                        { value: 'whitelist', label: 'Whitelist' },
                        { value: 'ops', label: 'Operators' },
                        { value: 'banned', label: 'Banned' },
                        { value: 'known', label: 'Everyone' },
                    ]}
                />
                <form
                    className='ml-auto flex w-full gap-2 sm:w-auto'
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!valid) return;
                        void run(`whitelist add ${name}`, `Whitelisted ${name}.`);
                        setName('');
                    }}
                >
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value.trim())}
                        placeholder='Player name'
                        aria-label='Player name'
                        className='h-9 min-w-0 flex-1 rounded-full border border-input-border bg-input px-4 text-sm sm:w-48'
                    />
                    <Button type='submit' disabled={!valid || !canConsole}>
                        <ListChecks className='size-4' aria-hidden /> Whitelist
                    </Button>
                </form>
            </div>

            {people.length === 0 ? (
                <Empty className='rounded-xl border border-border py-10'>
                    <EmptyHeader>
                        <EmptyMedia variant='icon'>
                            <Users />
                        </EmptyMedia>
                        <EmptyTitle>{tab === 'online' ? 'Nobody online' : 'Nobody here yet'}</EmptyTitle>
                        <EmptyDescription>
                            {tab === 'online' && !online
                                ? 'Start the server to see who is playing.'
                                : 'Players show up here as the server sees them.'}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            ) : (
                <ul className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
                    {people.map((p) => (
                        <li key={p.name} className='flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5'>
                            <img src={head(p.name)} alt='' loading='lazy' className='size-9 rounded-md [image-rendering:pixelated]' />
                            <span className='min-w-0 flex-1'>
                                <span className='flex items-center gap-1.5 truncate text-sm font-semibold'>
                                    {p.name}
                                    {opNames.has(p.name.toLowerCase()) && <Crown className='size-3 text-warning' aria-label='operator' />}
                                </span>
                                {p.note && <span className='block truncate text-xs text-muted-foreground'>{p.note}</span>}
                            </span>
                            <span className='flex'>{actionsFor(p)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Page>
    );
}
