import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Download, ExternalLink, Package, Search, Trash2 } from 'lucide-react';
import {
    Alert,
    Badge,
    Button,
    Dialog,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    Spinner,
    Switch,
    Tooltip,
    cn,
    fromNow,
    toast,
    useDebouncedCallback,
} from '@pterodactyl/sdk';
import { useObsidian } from '../../lib/settings';
import { isModded, softwareLabel } from '../lib/minecraft';
import {
    categories,
    compact,
    downloadFor,
    looksInstalled,
    pageSize,
    search,
    type Kind,
    type Project,
    type Source,
} from '../lib/sources';
import { useDirectory, useToolkit } from '../lib/useToolkit';
import Page, { Segmented, attempt } from '../ui/Page';
import Collapse from '../../ui/Collapse';
import { bytes } from '../ui/format';

const SOURCE_LABELS: Record<Source, string> = {
    modrinth: 'Modrinth',
    hangar: 'Hangar',
    spigot: 'SpigotMC',
    curseforge: 'CurseForge',
};

interface KindConfig {
    readonly label: string;
    readonly sources: readonly Source[];

    readonly directory: string | null;

    readonly match: RegExp | null;
    readonly example: string;
}

export const KINDS: Record<Kind, KindConfig> = {
    plugin: {
        label: 'Plugins',
        sources: ['modrinth', 'hangar', 'spigot', 'curseforge'],
        directory: '/plugins',
        match: /\.jar(\.disabled)?$/i,
        example: 'Chunky',
    },
    mod: {
        label: 'Mods',
        sources: ['modrinth', 'curseforge'],
        directory: '/mods',
        match: /\.jar(\.disabled)?$/i,
        example: 'Lithium',
    },
    modpack: {
        label: 'Modpacks',
        sources: ['modrinth', 'curseforge'],
        directory: null,
        match: null,
        example: 'Fabulously Optimized',
    },
    datapack: {
        label: 'Datapacks',
        sources: ['modrinth'],
        directory: null,
        match: /\.zip(\.disabled)?$/i,
        example: 'Terralith',
    },
    resourcepack: {
        label: 'Resource packs',
        sources: ['modrinth'],
        directory: null,
        match: null,
        example: 'Fresh Animations',
    },
};

export function parseJarName(file: string): { name: string; version: string | null } {
    const base = file.replace(/\.(jar|zip)(\.disabled)?$/i, '').replace(/\s*\(\d+\)$/, '');
    const match = /^(.*?)[-_ ]v?(\d[\w.+-]*)$/.exec(base);
    const name = (match ? match[1] : base).replace(/[-_](paper|bukkit|spigot|velocity|purpur|folia|fabric)$/i, '');
    return { name: name || base, version: match ? match[2] : null };
}

function Installed({ directory, entries }: { directory: string; entries: { name: string; size: number }[] }) {
    const { api, id } = useToolkit();
    const client = useQueryClient();
    const [busy, setBusy] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const refresh = () => client.invalidateQueries({ queryKey: ['obsidian-mc', id, 'dir', directory] });

    const rows = useMemo(() => {
        const parsed = entries.map((e) => ({
            file: e.name,
            size: e.size,
            ...parseJarName(e.name),
            enabled: !e.name.endsWith('.disabled'),
        }));
        const counts = new Map<string, number>();
        parsed.forEach((r) => counts.set(r.name.toLowerCase(), (counts.get(r.name.toLowerCase()) ?? 0) + 1));
        const needle = filter.trim().toLowerCase();
        return parsed
            .map((r) => ({ ...r, duplicate: (counts.get(r.name.toLowerCase()) ?? 0) > 1 }))
            .filter((r) => !needle || r.name.toLowerCase().includes(needle))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }, [entries, filter]);
    const off = entries.filter((e) => e.name.endsWith('.disabled')).length;

    const toggle = async (name: string) => {
        setBusy(name);
        const enabled = !name.endsWith('.disabled');
        await attempt(
            () => api.rename(directory, name, enabled ? `${name}.disabled` : name.replace(/\.disabled$/, '')),
            `${enabled ? 'Disabled' : 'Enabled'} ${parseJarName(name).name}. Restart to apply.`,
            toast
        );
        await refresh();
        setBusy(null);
    };

    if (entries.length === 0) {
        return (
            <Empty className='rounded-xl border border-border py-10'>
                <EmptyHeader>
                    <EmptyMedia variant='icon'>
                        <Package />
                    </EmptyMedia>
                    <EmptyTitle>Nothing installed yet</EmptyTitle>
                    <EmptyDescription>Anything you install from Browse lands in {directory}.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className='flex flex-col gap-3'>
            <div className='flex flex-wrap items-center gap-3'>
                <label className='flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 sm:max-w-xs'>
                    <Search className='size-4 text-muted-foreground' aria-hidden />
                    <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder='Filter installed'
                        aria-label='Filter installed'
                        className='h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0'
                    />
                </label>
                <span className='text-xs text-muted-foreground'>
                    {entries.length - off} on{off > 0 && ` · ${off} off`} · in {directory}
                </span>
            </div>
            <ul className='obs-stagger divide-y divide-border overflow-hidden rounded-xl border border-border bg-card'>
                {rows.map((row, i) => (
                    <li
                        key={row.file}
                        style={{ '--i': i } as React.CSSProperties}
                        className={cn(
                            'group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40',
                            !row.enabled && 'text-muted-foreground'
                        )}
                    >
                        <span className='min-w-0 flex-1'>
                            <span className='flex items-center gap-2'>
                                <span className='truncate text-sm font-semibold'>{row.name}</span>
                                {row.duplicate && (
                                    <Badge size='sm' tone='warning' variant='soft'>
                                        Duplicate
                                    </Badge>
                                )}
                            </span>
                            <span className='block truncate text-xs text-muted-foreground'>
                                {row.version ? `v${row.version} · ` : ''}
                                {bytes(row.size)}
                            </span>
                        </span>
                        <Tooltip content='Delete'>
                            <button
                                type='button'
                                aria-label={`Delete ${row.name}`}
                                onClick={() => setRemoving(row.file)}
                                className='grid size-8 place-items-center rounded-full text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100'
                            >
                                <Trash2 className='size-3.5' aria-hidden />
                            </button>
                        </Tooltip>
                        {busy === row.file ? (
                            <Spinner size='small' />
                        ) : (
                            <Switch
                                checked={row.enabled}
                                aria-label={`${row.enabled ? 'Disable' : 'Enable'} ${row.name}`}
                                onChange={() => toggle(row.file)}
                            />
                        )}
                    </li>
                ))}
            </ul>
            <Dialog.Confirm
                open={removing !== null}
                onClose={() => setRemoving(null)}
                title={`Delete ${removing ? parseJarName(removing).name : ''}?`}
                confirm='Delete'
                onConfirmed={async () => {
                    if (!removing) return;
                    await attempt(
                        () => api.remove(directory, [removing]),
                        `Deleted ${parseJarName(removing).name}.`,
                        toast
                    );
                    setRemoving(null);
                    await refresh();
                }}
            >
                The file is removed from {directory}. Config folders stay, so reinstalling keeps your settings.
            </Dialog.Confirm>
        </div>
    );
}

function ProjectCard({ project, installed, action }: { project: Project; installed: boolean; action: ReactNode }) {
    return (
        <li className='flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/15'>
            <div className='flex items-start gap-3'>
                {project.icon ? (
                    <img
                        src={project.icon}
                        alt=''
                        loading='lazy'
                        decoding='async'
                        className='size-12 shrink-0 rounded-lg border border-border object-cover'
                    />
                ) : (
                    <span className='grid size-12 shrink-0 place-items-center rounded-lg border border-border bg-muted'>
                        <Package className='size-5 text-muted-foreground' aria-hidden />
                    </span>
                )}
                <div className='min-w-0 flex-1'>
                    <a
                        href={project.page}
                        target='_blank'
                        rel='noreferrer'
                        className='flex items-center gap-1.5 font-bold tracking-tight text-foreground no-underline hover:underline'
                    >
                        <span className='truncate'>{project.title}</span>
                        <ExternalLink className='size-3 shrink-0 text-muted-foreground' aria-hidden />
                    </a>
                    <p className='truncate text-xs text-muted-foreground'>by {project.author}</p>
                </div>
            </div>
            <p className='line-clamp-2 flex-1 text-sm text-muted-foreground'>{project.description}</p>
            {project.tags.length > 0 && (
                <div className='flex flex-wrap gap-1'>
                    {project.tags.map((tag) => (
                        <span
                            key={tag}
                            className='rounded-md border border-border px-1.5 py-0.5 text-[0.68rem] text-muted-foreground capitalize'
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}
            <div className='flex items-center gap-3'>
                <span className='min-w-0 flex-1 truncate text-xs text-muted-foreground'>
                    <strong className='text-foreground'>{compact(project.downloads)}</strong> downloads
                    {project.updated && <> · {fromNow(project.updated)}</>}
                </span>
                {installed ? (
                    <Badge tone='success' variant='soft'>
                        <Check className='size-3' aria-hidden /> Installed
                    </Badge>
                ) : project.external ? (
                    <Tooltip content='The author only allows downloads from their own page'>
                        <a
                            href={project.page}
                            target='_blank'
                            rel='noreferrer'
                            className='text-xs font-semibold text-muted-foreground underline underline-offset-4'
                        >
                            Get it on site
                        </a>
                    </Tooltip>
                ) : (
                    action
                )}
            </div>
        </li>
    );
}

export interface BrowserAction {
    readonly label: string;
    readonly run: (project: Project, source: Source) => Promise<void>;
}

export function Browser({ kind, directory, action }: { kind: Kind; directory?: string; action?: BrowserAction }) {
    const { api, id, server, installed: software, loaders, gameVersion, loading } = useToolkit();
    const { curseforgeKey } = useObsidian();
    const client = useQueryClient();
    const config = KINDS[kind];
    const folder = directory ?? config.directory;
    const listing = useDirectory(folder ?? '/');
    const sources = config.sources.filter((s) => s !== 'curseforge' || curseforgeKey.trim() !== '');
    const [source, setSource] = useState<Source>(sources[0]);
    const [query, setQuery] = useState('');
    const [term, setTerm] = useState('');
    const [category, setCategory] = useState('all');
    const [version, setVersion] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [tab, setTab] = useState<'browse' | 'installed'>('browse');
    const [moreCategories, setMoreCategories] = useState(false);
    const debounced = useDebouncedCallback((value: string) => setTerm(value), 350);

    useEffect(() => setVersion(gameVersion ?? ''), [gameVersion]);

    const files = useMemo(
        () =>
            folder && config.match
                ? (listing.data ?? [])
                      .filter((e) => e.isFile && config.match!.test(e.name))
                      .sort((a, b) => a.name.localeCompare(b.name))
                : [],
        [listing.data, folder, config.match]
    );
    const names = files.map((f) => f.name);

    const results = useInfiniteQuery({
        queryKey: [
            'obsidian-mc',
            'search',
            kind,
            source,
            term,
            category,
            version,
            loaders.join(','),
            source === 'curseforge' ? curseforgeKey : '',
        ],
        queryFn: ({ pageParam }) =>
            search(source, {
                query: term,
                kind,
                loaders,
                gameVersion: version || null,
                category,
                offset: pageParam,
                cfKey: curseforgeKey,
            }),
        initialPageParam: 0,
        getNextPageParam: (last, pages) => {
            const loaded = pages.length * pageSize;
            return last.hits.length === pageSize && loaded < last.total ? loaded : undefined;
        },
        enabled: !loading,
        staleTime: 5 * 60_000,
    });

    const install = async (project: Project) => {
        if (!folder) return;
        const file = await downloadFor(project, loaders, version || null, kind, curseforgeKey);
        await api.mkdir('/', folder.slice(1)).catch(() => undefined);
        await api.install(file.url, folder, file.filename, { maxMb: server.attributes.upload_size });
        if (!file.exact && version)
            toast.warning(`${project.title} has no build marked for ${version}; installed the newest one.`);
    };

    const run = async (project: Project) => {
        setBusy(project.id);
        if (action) {
            try {
                await action.run(project, source);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : String(error));
            }
        } else {
            await attempt(() => install(project), `Installed ${project.title}. Restart the server to load it.`, toast);
            await client.invalidateQueries({ queryKey: ['obsidian-mc', id, 'dir', folder] });
        }
        setBusy(null);
    };

    const hits = results.data?.pages.flatMap((p) => p.hits) ?? [];
    const sourceLabel = SOURCE_LABELS[source];
    const showCategories = source === 'modrinth' || source === 'hangar';

    const hasInstalled = !!folder && !!config.match;
    const allCategories = categories.filter((c) => c.id === 'all' || (source === 'modrinth' ? c.modrinth : c.hangar));
    const primaryCategories = allCategories.slice(0, 5);
    const extraCategories = allCategories.slice(5);
    const categoryChip = (c: (typeof categories)[number]) => (
        <button
            key={c.id}
            type='button'
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-200',
                category === c.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
            )}
        >
            {c.label}
        </button>
    );

    return (
        <div className='flex flex-col gap-5'>
            {hasInstalled && (
                <Segmented
                    label='View'
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'browse', label: 'Browse' },
                        {
                            value: 'installed',
                            label: (
                                <>
                                    Installed
                                    <span className='rounded-full bg-foreground/10 px-1.5 text-[0.65rem] tabular-nums'>
                                        {files.length}
                                    </span>
                                </>
                            ),
                        },
                    ]}
                    className='self-start'
                />
            )}

            {hasInstalled && tab === 'installed' ? (
                listing.isLoading ? (
                    <Spinner centered />
                ) : (
                    <Installed directory={folder!} entries={files} />
                )
            ) : (
                <>
                    <div className='flex flex-col gap-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <label className='flex h-11 min-w-0 flex-1 basis-72 items-center gap-3 rounded-full border border-input-border bg-input px-4'>
                                <Search className='size-4 text-muted-foreground' aria-hidden />
                                <input
                                    value={query}
                                    onChange={(e) => {
                                        setQuery(e.target.value);
                                        debounced(e.target.value);
                                    }}
                                    placeholder={`Search ${sourceLabel} for ${config.example}`}
                                    aria-label={`Search ${config.label.toLowerCase()}`}
                                    className='h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0'
                                />
                            </label>
                            {sources.length > 1 && (
                                <Segmented
                                    label='Source'
                                    size='sm'
                                    value={source}
                                    options={sources.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
                                    onChange={(s) => {
                                        setSource(s);
                                        setCategory('all');
                                    }}
                                />
                            )}
                            <label className='flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs'>
                                <span className='text-muted-foreground'>MC</span>
                                <input
                                    value={version}
                                    onChange={(e) => setVersion(e.target.value.trim())}
                                    placeholder='any'
                                    aria-label='Minecraft version'
                                    className='w-14 border-0 bg-transparent p-0 font-mono text-xs outline-none focus:ring-0'
                                />
                            </label>
                        </div>
                        {showCategories && (kind === 'plugin' || kind === 'mod') && (
                            <div className='flex flex-col'>
                                <div className='flex flex-wrap items-center gap-1.5'>
                                    {primaryCategories.map(categoryChip)}
                                    {extraCategories.length > 0 && (
                                        <button
                                            type='button'
                                            aria-expanded={moreCategories}
                                            onClick={() => setMoreCategories(!moreCategories)}
                                            className='flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
                                        >
                                            {moreCategories ? 'Less' : `${extraCategories.length} more`}
                                            <ChevronDown
                                                className={cn(
                                                    'size-3.5 transition-transform duration-200',
                                                    moreCategories && 'rotate-180'
                                                )}
                                                aria-hidden
                                            />
                                        </button>
                                    )}
                                </div>
                                <Collapse open={moreCategories || extraCategories.some((c) => c.id === category)}>
                                    <div className='flex flex-wrap gap-1.5 pt-1.5'>
                                        {extraCategories.map(categoryChip)}
                                    </div>
                                </Collapse>
                            </div>
                        )}
                        <p className='text-xs text-muted-foreground'>
                            Matched to {software ? softwareLabel[software.software] : 'this server'}{' '}
                            {version || 'on any version'}
                            {folder && `, installs to ${folder}`}
                        </p>
                    </div>

                    <section>
                        <div className='mb-3 flex flex-wrap items-baseline justify-between gap-2'>
                            <h2 className='text-lg font-bold tracking-tight'>
                                {term ? `Results for "${term}"` : 'Popular'}
                            </h2>
                            {!term && (
                                <span className='text-xs text-muted-foreground'>Most downloaded on {sourceLabel}</span>
                            )}
                        </div>
                        {results.isLoading && <Spinner size='large' centered />}
                        {results.isError && <Alert type='danger'>{(results.error as Error).message}</Alert>}
                        {!results.isLoading && hits.length === 0 && !results.isError && (
                            <Empty className='rounded-xl border border-border py-10'>
                                <EmptyHeader>
                                    <EmptyMedia variant='icon'>
                                        <Search />
                                    </EmptyMedia>
                                    <EmptyTitle>Nothing found</EmptyTitle>
                                    <EmptyDescription>
                                        Try another search, category or Minecraft version.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}
                        <ul className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                            {hits.map((project) => (
                                <ProjectCard
                                    key={`${project.source}:${project.id}`}
                                    project={project}
                                    installed={
                                        config.match !== null && looksInstalled(names, project.slug, project.title)
                                    }
                                    action={
                                        <Button
                                            size='xsmall'
                                            onClick={() => run(project)}
                                            isLoading={busy === project.id}
                                            disabled={busy !== null}
                                        >
                                            <Download className='size-3.5' aria-hidden /> {action?.label ?? 'Install'}
                                        </Button>
                                    }
                                />
                            ))}
                        </ul>
                        {results.hasNextPage && (
                            <div className='mt-5 flex justify-center'>
                                <Button
                                    color='grey'
                                    onClick={() => results.fetchNextPage()}
                                    isLoading={results.isFetchingNextPage}
                                >
                                    Load more
                                </Button>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

export default function BrowserScreen({ kind }: { kind: 'plugin' | 'mod' }) {
    const { installed: software } = useToolkit();
    const config = KINDS[kind];
    const mismatch =
        software &&
        software.software !== 'unknown' &&
        (kind === 'mod' ? !isModded(software.software) : isModded(software.software));

    return (
        <Page
            title={config.label}
            description={`Find and install ${config.label.toLowerCase()} from ${config.sources.map((s) => SOURCE_LABELS[s]).join(', ')} in one click.`}
        >
            {mismatch && (
                <Alert type='warning'>
                    This server runs {softwareLabel[software.software]}, which{' '}
                    {kind === 'mod'
                        ? 'loads plugins, not mods. Switch to Fabric on the Versions page to use mods.'
                        : 'loads mods, not plugins. Use the Mods page instead.'}
                </Alert>
            )}
            <Browser kind={kind} />
        </Page>
    );
}
