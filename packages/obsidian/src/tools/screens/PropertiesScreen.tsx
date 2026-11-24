import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, RotateCcw, Save, Search } from 'lucide-react';
import { Alert, Button, Spinner, Switch, cn, toast } from '@pterodactyl/sdk';
import {
    COLORS,
    FIELDS,
    GROUPS,
    QUICK,
    fieldByKey,
    parseMotd,
    parseProperties,
    serializeProperties,
    type Field,
} from '../lib/properties';
import { useToolkit } from '../lib/useToolkit';
import Page, { Eyebrow, attempt } from '../ui/Page';
import Collapse from '../../ui/Collapse';

const FILE = '/server.properties';

const YamlEditor = lazy(() => import('../lib/yaml-editor'));

const CONFIGS = [
    { label: 'Bukkit', file: '/bukkit.yml' },
    { label: 'Spigot', file: '/spigot.yml' },
    { label: 'Paper', file: '/config/paper-global.yml' },
    { label: 'Paper worlds', file: '/config/paper-world-defaults.yml' },
];

const bool = (value: string | undefined) => value === 'true';

function Control({ field, value, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
    const { kind } = field;
    const input =
        'h-9 w-full rounded-lg border border-input-border bg-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring';

    if (kind.type === 'toggle') {
        return (
            <Switch checked={bool(value)} onChange={() => onChange(String(!bool(value)))} aria-label={field.label} />
        );
    }
    if (kind.type === 'select') {
        const options = Object.entries(kind.options);
        return (
            <div className='flex flex-wrap gap-1'>
                {(options.some(([k]) => k === value) || !value
                    ? options
                    : [...options, [value, value] as [string, string]]
                ).map(([k, label]) => (
                    <button
                        key={k}
                        type='button'
                        aria-pressed={value === k}
                        onClick={() => onChange(k)}
                        className={cn(
                            'rounded-full border px-2.5 py-1 text-xs font-semibold',
                            value === k
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border hover:bg-muted'
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>
        );
    }
    if (kind.type === 'number') {
        return (
            <input
                type='number'
                value={value}
                min={kind.min}
                max={kind.max}
                onChange={(e) => onChange(e.target.value)}
                aria-label={field.label}
                className={cn(input, 'font-mono')}
            />
        );
    }
    return (
        <input value={value} onChange={(e) => onChange(e.target.value)} aria-label={field.label} className={input} />
    );
}

function Tile({ field, value, onChange }: { field: Field; value: string; onChange: (value: string) => void }) {
    const { kind } = field;
    return (
        <div className='flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4'>
            <Eyebrow>{field.label}</Eyebrow>
            {kind.type === 'toggle' ? (
                <div className='flex items-end justify-between'>
                    <span className={cn('text-2xl font-bold', bool(value) ? 'text-success' : 'text-muted-foreground')}>
                        {bool(value) ? 'On' : 'Off'}
                    </span>
                    <Control field={field} value={value} onChange={onChange} />
                </div>
            ) : kind.type === 'number' ? (
                <>
                    <span className='text-2xl font-bold tabular-nums'>
                        {value || '-'} <span className='text-xs font-medium text-muted-foreground'>{kind.unit}</span>
                    </span>
                    <input
                        type='range'
                        min={kind.min ?? 0}
                        max={Math.min(kind.max ?? 100, field.key === 'max-players' ? 200 : 64)}
                        value={Number(value) || 0}
                        onChange={(e) => onChange(e.target.value)}
                        aria-label={field.label}
                        className='w-full accent-(--primary)'
                    />
                </>
            ) : (
                <Control field={field} value={value} onChange={onChange} />
            )}
        </div>
    );
}

function Motd({
    value,
    onChange,
    maxPlayers,
}: {
    value: string;
    onChange: (value: string) => void;
    maxPlayers: string;
}) {
    const { server } = useToolkit();
    const lines = value.split(/\\n|\n/).slice(0, 2);

    return (
        <div className='flex flex-col gap-3 rounded-xl border border-border bg-card p-4'>
            <div className='flex gap-3 rounded-lg bg-[#1e1e1e] p-3 font-mono text-sm'>
                <span className='grid size-14 shrink-0 place-items-center rounded-md bg-black/40 text-[#aaa]'>MC</span>
                <div className='min-w-0 flex-1'>
                    <p className='flex justify-between text-white'>
                        <span className='truncate'>{server.attributes.name}</span>
                        <span className='text-[#aaa]'>0/{maxPlayers || '20'}</span>
                    </p>
                    {lines.map((line, i) => (
                        <p key={i} className='truncate text-[#aaa]'>
                            {parseMotd(line).map((span, j) => (
                                <span
                                    key={j}
                                    style={{
                                        color: span.color ?? undefined,
                                        fontWeight: span.bold ? 700 : undefined,
                                        fontStyle: span.italic ? 'italic' : undefined,
                                        textDecoration:
                                            [span.underline && 'underline', span.strike && 'line-through']
                                                .filter(Boolean)
                                                .join(' ') || undefined,
                                    }}
                                >
                                    {span.text}
                                </span>
                            ))}
                        </p>
                    ))}
                </div>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label='Message of the day'
                    className='h-10 min-w-0 flex-1 rounded-lg border border-input-border bg-input px-3 font-mono text-sm'
                />
                <div className='flex flex-wrap gap-1'>
                    {Object.entries(COLORS).map(([code, colour]) => (
                        <button
                            key={code}
                            type='button'
                            title={`§${code}`}
                            aria-label={`Insert colour ${code}`}
                            onClick={() => onChange(`${value}§${code}`)}
                            className='size-5 rounded border border-border'
                            style={{ backgroundColor: colour }}
                        />
                    ))}
                    {[
                        ['l', 'B'],
                        ['o', 'I'],
                        ['r', '↺'],
                    ].map(([code, label]) => (
                        <button
                            key={code}
                            type='button'
                            title={`§${code}`}
                            onClick={() => onChange(`${value}§${code}`)}
                            className='grid size-5 place-items-center rounded border border-border text-[0.65rem] font-bold'
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            <p className='text-xs text-muted-foreground'>Use \n for a second line.</p>
        </div>
    );
}

export default function PropertiesScreen() {
    const { id, api } = useToolkit();
    const client = useQueryClient();
    const file = useQuery({
        queryKey: ['obsidian-mc', id, 'properties'],
        queryFn: async () => parseProperties((await api.readOrNull(FILE)) ?? ''),
    });
    const [values, setValues] = useState<Record<string, string>>({});
    const [tab, setTab] = useState('server');
    const [term, setTerm] = useState('');
    const [changesOnly, setChangesOnly] = useState(false);
    const [open, setOpen] = useState<string[]>(['Basics']);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (file.data) setValues({ ...file.data.values });
    }, [file.data]);

    const original = file.data?.values ?? {};
    const changed = Object.keys(values).filter((k) => values[k] !== original[k]);
    const set = (key: string) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

    const matches = (f: { key: string; label: string; help: string }) => {
        const needle = term.trim().toLowerCase();
        return (
            (!needle || [f.key, f.label, f.help].some((s) => s.toLowerCase().includes(needle))) &&
            (!changesOnly || changed.includes(f.key))
        );
    };

    const advanced = useMemo(
        () =>
            Object.keys(values)
                .filter((k) => !fieldByKey.has(k))
                .sort()
                .map((key) => ({
                    key,
                    label: key,
                    help: '',
                    group: 'Extras' as const,
                    kind: { type: 'text' as const },
                })),
        [values]
    );

    const save = async () => {
        if (!file.data) return;
        setSaving(true);
        await attempt(
            () => api.write(FILE, serializeProperties(file.data!, values)),
            'Saved. Restart the server to apply.',
            toast
        );
        await client.invalidateQueries({ queryKey: ['obsidian-mc', id, 'properties'] });
        setSaving(false);
    };

    const sections = [
        ...GROUPS.map((group) => ({
            name: group,
            fields: FIELDS.filter((f) => f.group === group && f.key !== 'motd' && f.key in values),
        })),
        { name: 'Advanced', fields: advanced },
    ];

    return (
        <Page
            title='Properties'
            description='Every server setting in plain words, with search and undo.'
            actions={
                tab === 'server' && (
                    <div className='flex gap-2'>
                        <Button
                            color='grey'
                            disabled={changed.length === 0 || saving}
                            onClick={() => setValues({ ...original })}
                        >
                            <RotateCcw className='size-4' aria-hidden /> Undo
                            {changed.length > 0 && ` ${changed.length}`}
                        </Button>
                        <Button disabled={changed.length === 0} isLoading={saving} onClick={save}>
                            <Save className='size-4' aria-hidden /> Save
                        </Button>
                    </div>
                )
            }
        >
            <div className='flex flex-wrap items-center gap-2'>
                <div role='tablist' aria-label='Config file' className='flex flex-wrap gap-1'>
                    {[{ label: 'Server', file: 'server' }, ...CONFIGS].map((c) => (
                        <button
                            key={c.file}
                            type='button'
                            role='tab'
                            aria-selected={tab === c.file}
                            onClick={() => setTab(c.file)}
                            className={cn(
                                'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                                tab === c.file
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
                <label className='ml-auto flex h-10 w-full items-center gap-2 rounded-full border border-border bg-card px-4 sm:w-72'>
                    <Search className='size-4 text-muted-foreground' aria-hidden />
                    <input
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder='Search every setting'
                        aria-label='Search every setting'
                        className='h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0'
                    />
                </label>
                <button
                    type='button'
                    aria-pressed={changesOnly}
                    onClick={() => setChangesOnly(!changesOnly)}
                    className={cn(
                        'h-10 rounded-full border px-4 text-xs font-semibold',
                        changesOnly ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'
                    )}
                >
                    Changes only
                </button>
            </div>

            {tab !== 'server' && (
                <Suspense fallback={<Spinner size='large' centered />}>
                    <YamlEditor file={tab} term={term} changesOnly={changesOnly} />
                </Suspense>
            )}

            {tab === 'server' && (
                <>
                    {file.isLoading && <Spinner size='large' centered />}
                    {file.data && Object.keys(file.data.values).length === 0 && (
                        <Alert type='info'>
                            No server.properties yet. Start the server once and Minecraft writes it.
                        </Alert>
                    )}

                    {file.data && !term && !changesOnly && 'motd' in values && (
                        <>
                            <Motd
                                value={values.motd ?? ''}
                                onChange={set('motd')}
                                maxPlayers={values['max-players'] ?? ''}
                            />
                            <div className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5'>
                                {QUICK.filter((k) => k in values).map((key) => (
                                    <Tile
                                        key={key}
                                        field={fieldByKey.get(key)!}
                                        value={values[key] ?? ''}
                                        onChange={set(key)}
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    <div className='flex flex-col gap-2.5'>
                        {sections.map(({ name, fields }) => {
                            const shown = fields.filter(matches);
                            if (shown.length === 0) return null;
                            const expanded = term !== '' || changesOnly || open.includes(name);
                            return (
                                <section key={name} className='rounded-xl border border-border bg-card'>
                                    <button
                                        type='button'
                                        aria-expanded={expanded}
                                        onClick={() =>
                                            setOpen(expanded ? open.filter((g) => g !== name) : [...open, name])
                                        }
                                        className='flex w-full items-center gap-3 px-5 py-4 text-left'
                                    >
                                        <span className='font-bold'>{name}</span>
                                        <span className='text-xs text-muted-foreground'>{shown.length} settings</span>
                                        <ChevronDown
                                            className={cn(
                                                'ml-auto size-4 text-muted-foreground transition',
                                                expanded && 'rotate-180'
                                            )}
                                            aria-hidden
                                        />
                                    </button>
                                    <Collapse open={expanded}>
                                        <ul className='divide-y divide-border border-t border-border'>
                                            {shown.map((field) => (
                                                <li
                                                    key={field.key}
                                                    className='grid items-center gap-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]'
                                                >
                                                    <div className='min-w-0'>
                                                        <p className='flex items-center gap-2 text-sm font-semibold'>
                                                            {field.label}
                                                            {changed.includes(field.key) && (
                                                                <span
                                                                    className='size-1.5 rounded-full bg-warning'
                                                                    aria-label='changed'
                                                                />
                                                            )}
                                                        </p>
                                                        <p className='text-xs text-muted-foreground'>
                                                            {field.help && `${field.help} `}
                                                            <code className='font-mono opacity-70'>{field.key}</code>
                                                        </p>
                                                    </div>
                                                    <div className='flex md:justify-end'>
                                                        <Control
                                                            field={field}
                                                            value={values[field.key] ?? ''}
                                                            onChange={set(field.key)}
                                                        />
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </Collapse>
                                </section>
                            );
                        })}
                    </div>
                </>
            )}
        </Page>
    );
}
