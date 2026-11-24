import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink, Package, Power, Search, Trash2 } from 'lucide-react';
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
import Page, { Eyebrow, Panel, Segmented, attempt } from '../ui/Page';
import { bytes } from '../ui/format';

const SOURCE_LABELS: Record<Source, string> = { modrinth: 'Modrinth', hangar: 'Hangar', spigot: 'SpigotMC', curseforge: 'CurseForge' };

interface KindConfig {
    readonly label: string;
    readonly sources: readonly Source[];
    /** Where installs land; datapacks pass their world's folder in. */
    readonly directory: string | null;
    /** The files in `directory` that count as installed. */
    readonly match: RegExp | null;
    readonly example: string;
}

export const KINDS: Record<Kind, KindConfig> = {
    plugin: { label: 'Plugins', sources: ['modrinth', 'hangar', 'spigot', 'curseforge'], directory: '/plugins', match: /\.jar(\.disabled)?$/i, example: 'Chunky' },
    mod: { label: 'Mods', sources: ['modrinth', 'curseforge'], directory: '/mods', match: /\.jar(\.disabled)?$/i, example: 'Lithium' },
    modpack: { label: 'Modpacks', sources: ['modrinth', 'curseforge'], directory: null, match: null, example: 'Fabulously Optimized' },
    datapack: { label: 'Datapacks', sources: ['modrinth'], directory: null, match: /\.zip(\.disabled)?$/i, example: 'Terralith' },
    resourcepack: { label: 'Resource packs', sources: ['modrinth'], directory: null, match: null, example: 'Fresh Animations' },
};

/** The installed files of a folder, with enable/disable (a `.disabled` suffix) and delete. */
function Installed({ directory, entries }: { directory: string; entries: { name: string; size: number }[] }) {
    const { api, id } = useToolkit();
    const client = useQueryClient();
    const [busy, setBusy] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const refresh = () => client.invalidateQueries({ queryKey: ['obsidian-mc', id, 'dir', directory] });

    const toggle = async (name: string) => {
        setBusy(name);
        const enabled = !name.endsWith('.disabled');
        await attempt(
            () => api.rename(directory, name, enabled ? `${name}.disabled` : name.replace(/\.disabled$/, '')),
            `${enabled ? 'Disabled' : 'Enabled'} ${name.replace(/\.disabled$/, '')}. Restart to apply.`,
            toast
        );
        await refresh();
        setBusy(null);
    };

    if (entries.length === 0) return <p className='text-sm text-muted-foreground'>Nothing installed in {directory} yet.</p>;

    return (
        <>
            <ul className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
                {entries.map(({ name, size }) => {
                    const enabled = !name.endsWith('.disabled');
                    return (
                        <li key={name} className={cn('flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2', !enabled && 'opacity-60')}>
                            <Package className='size-4 shrink-0 text-muted-foreground' aria-hidden />
                            <span className='min-w-0 flex-1'>
                                <span className='block truncate text-sm font-medium'>{name.replace(/\.(jar|zip)(\.disabled)?$/i, '')}</span>
                                <span className='text-xs text-muted-foreground'>
                                    {bytes(size)} {!enabled && '· disabled'}
                                </span>
                            </span>
                            <Tooltip content={enabled ? 'Disable' : 'Enable'}>
                                <button
                                    type='button'
                                    aria-label={`${enabled ? 'Disable' : 'Enable'} ${name}`}
                                    disabled={busy === name}
                                    onClick={() => toggle(name)}
                                    className={cn('grid size-8 place-items-center rounded-full hover:bg-muted', enabled ? 'text-success' : 'text-muted-foreground')}
                                >
                                    {busy === name ? <Spinner size='small' /> : <Power className='size-3.5' aria-hidden />}
                                </button>
                            </Tooltip>
                            <Tooltip content='Delete'>
                                <button
                                    type='button'
                                    aria-label={`Delete ${name}`}
                                    onClick={() => setRemoving(name)}
                                    className='grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                                >
                                    <Trash2 className='size-3.5' aria-hidden />
                                </button>
                            </Tooltip>
                        </li>
                    );
                })}
            </ul>
            <Dialog.Confirm
                open={removing !== null}
                onClose={() => setRemoving(null)}
                title={`Delete ${removing ?? ''}?`}
                confirm='Delete'
                onConfirmed={async () => {
                    if (!removing) return;
                    await attempt(() => api.remove(directory, [removing]), `Deleted ${removing}.`, toast);
                    setRemoving(null);
                    await refresh();
                }}
            >
                The file is removed from {directory}. Config folders stay, so reinstalling keeps your settings.
            </Dialog.Confirm>
        </>
    );
}

function ProjectCard({ project, installed, action }: { project: Project; installed: boolean; action: ReactNode }) {
    return (
        <li className='flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/15'>
            <div className='flex items-start gap-3'>
                {project.icon ? (
                    <img src={project.icon} alt='' loading='lazy' decoding='async' className='size-12 shrink-0 rounded-lg border border-border object-cover' />
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
                        <span key={tag} className='rounded-md border border-border px-1.5 py-0.5 text-[0.68rem] text-muted-foreground capitalize'>
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
                        <a href={project.page} target='_blank' rel='noreferrer' className='text-xs font-semibold text-muted-foreground underline underline-offset-4'>
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

/**
 * The search, filters, installed files and results for one kind of content. Plugins and mods install
 * into their folder; packs pass an `action` of their own.
 */
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
    const debounced = useDebouncedCallback((value: string) => setTerm(value), 350);

    useEffect(() => setVersion(gameVersion ?? ''), [gameVersion]);

    const files = useMemo(
        () =>
            folder && config.match
                ? (listing.data ?? []).filter((e) => e.isFile && config.match!.test(e.name)).sort((a, b) => a.name.localeCompare(b.name))
                : [],
        [listing.data, folder, config.match]
    );
    const names = files.map((f) => f.name);

    const results = useInfiniteQuery({
        queryKey: ['obsidian-mc', 'search', kind, source, term, category, version, loaders.join(','), source === 'curseforge' ? curseforgeKey : ''],
        queryFn: ({ pageParam }) =>
            search(source, { query: term, kind, loaders, gameVersion: version || null, category, offset: pageParam, cfKey: curseforgeKey }),
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
        if (!file.exact && version) toast.warning(`${project.title} has no build marked for ${version}; installed the newest one.`);
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

    return (
        <div className='flex flex-col gap-6'>
            <div className='relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6'>
                <div
                    aria-hidden
                    className='pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_16rem_at_0%_0%,color-mix(in_oklab,var(--success)_10%,transparent),transparent)]'
                />
                <div className='relative flex flex-col gap-4'>
                    <div>
                        <Eyebrow>
                            {config.label} · {sources.map((s) => SOURCE_LABELS[s]).join(' · ')}
                        </Eyebrow>
                        <h2 className='mt-1 text-2xl font-bold tracking-tight'>{config.label} that just work.</h2>
                        <p className='text-sm text-muted-foreground'>
                            Matched to {software ? softwareLabel[software.software] : '…'} {version || 'any version'}
                            {folder && ` · Installs to ${folder}`}
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        {sources.length > 1 && (
                            <Segmented
                                label='Source'
                                value={source}
                                options={sources.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
                                onChange={(s) => {
                                    setSource(s);
                                    setCategory('all');
                                }}
                            />
                        )}
                        <label className='flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs'>
                            <span className='text-muted-foreground'>MC</span>
                            <input
                                value={version}
                                onChange={(e) => setVersion(e.target.value.trim())}
                                placeholder='any'
                                aria-label='Minecraft version'
                                className='w-16 border-0 bg-transparent p-0 font-mono text-xs outline-none focus:ring-0'
                            />
                        </label>
                    </div>
                    <label className='flex h-12 items-center gap-3 rounded-xl border border-input-border bg-input px-4'>
                        <Search className='size-4 text-muted-foreground' aria-hidden />
                        <input
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                debounced(e.target.value);
                            }}
                            placeholder={`Search ${sourceLabel} for ${config.example}…`}
                            aria-label={`Search ${config.label.toLowerCase()}`}
                            className='h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0'
                        />
                    </label>
                    {showCategories && (kind === 'plugin' || kind === 'mod') && (
                        <div className='flex flex-wrap gap-1.5'>
                            {categories
                                .filter((c) => c.id === 'all' || (source === 'modrinth' ? c.modrinth : c.hangar))
                                .map((c) => (
                                    <button
                                        key={c.id}
                                        type='button'
                                        aria-pressed={category === c.id}
                                        onClick={() => setCategory(c.id)}
                                        className={cn(
                                            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                                            category === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {folder && config.match && (
                <Panel title={`Installed · ${files.length}`}>
                    {listing.isLoading ? <Spinner centered /> : <Installed directory={folder} entries={files} />}
                </Panel>
            )}

            <section>
                <div className='mb-3 flex flex-wrap items-baseline justify-between gap-2'>
                    <h2 className='text-lg font-bold tracking-tight'>{term ? `Results for “${term}”` : 'Spotlight'}</h2>
                    {!term && <span className='text-xs text-muted-foreground'>Most downloaded on {sourceLabel}</span>}
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
                            <EmptyDescription>Try another search, category or Minecraft version.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
                <ul className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                    {hits.map((project) => (
                        <ProjectCard
                            key={`${project.source}:${project.id}`}
                            project={project}
                            installed={config.match !== null && looksInstalled(names, project.slug, project.title)}
                            action={
                                <Button size='xsmall' onClick={() => run(project)} isLoading={busy === project.id} disabled={busy !== null}>
                                    <Download className='size-3.5' aria-hidden /> {action?.label ?? 'Install'}
                                </Button>
                            }
                        />
                    ))}
                </ul>
                {results.hasNextPage && (
                    <div className='mt-5 flex justify-center'>
                        <Button color='grey' onClick={() => results.fetchNextPage()} isLoading={results.isFetchingNextPage}>
                            Load more
                        </Button>
                    </div>
                )}
            </section>
        </div>
    );
}

/** The plugin or mod page: the browser, after a notice when the server cannot load this kind. */
export default function BrowserScreen({ kind }: { kind: 'plugin' | 'mod' }) {
    const { installed: software } = useToolkit();
    const config = KINDS[kind];
    const mismatch = software && software.software !== 'unknown' && (kind === 'mod' ? !isModded(software.software) : isModded(software.software));

    return (
        <Page title={config.label} description={`Find and install ${config.label.toLowerCase()} from ${config.sources.map((s) => SOURCE_LABELS[s]).join(', ')} in one click.`}>
            {mismatch && (
                <Alert type='warning'>
                    This server runs {softwareLabel[software.software]}, which{' '}
                    {kind === 'mod' ? 'loads plugins, not mods. Switch to Fabric on the Versions page to use mods.' : 'loads mods, not plugins. Use the Mods page instead.'}
                </Alert>
            )}
            <Browser kind={kind} />
        </Page>
    );
}
