import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Coffee, TriangleAlert } from 'lucide-react';
import {
    Badge,
    Button,
    Spinner,
    Switch,
    cn,
    toast,
    useServerPermission,
    useServerResources,
    useServerStartup,
    type SdkServerStartup,
} from '@pterodactyl/sdk';
import { MARKER, softwareLabel, type Installed } from '../lib/minecraft';
import { jarOf, providers, providerById, type Provider } from '../lib/software';
import { useToolkit } from '../lib/useToolkit';
import Page, { Eyebrow, Panel, Step, attempt } from '../ui/Page';
import SoftwareLogo from '../ui/SoftwareLogo';

function useRunState(uuid: string) {
    const { data } = useServerResources(uuid, (r) => r);
    const state = (data as unknown as { attributes?: { current_state?: string } } | undefined)?.attributes
        ?.current_state;
    return state === 'running' || state === 'starting' || state === 'stopping' ? state : 'offline';
}

function Current({ installed, jar, running }: { installed: Installed | undefined; jar: string; running: string }) {
    return (
        <div className='flex items-center gap-4 rounded-xl border border-border bg-card p-5'>
            <span className='grid size-14 place-items-center rounded-xl border border-border bg-muted'>
                <SoftwareLogo software={installed?.software ?? 'unknown'} className='size-6' />
            </span>
            <div className='min-w-0'>
                <Eyebrow>Now running</Eyebrow>
                <p className='text-2xl font-bold tracking-tight'>
                    {installed
                        ? installed.software === 'unknown'
                            ? 'Not detected'
                            : softwareLabel[installed.software]
                        : '...'}{' '}
                    <span className='font-semibold text-muted-foreground'>{installed?.version ?? ''}</span>
                </p>
                <div className='mt-1.5 flex flex-wrap gap-2'>
                    <Badge size='sm' tone={running === 'running' ? 'success' : 'neutral'} variant='soft'>
                        {running === 'running' ? 'Online' : running[0].toUpperCase() + running.slice(1)}
                    </Badge>
                    <Badge size='sm' tone='neutral' variant='soft'>
                        <span className='font-mono'>{jar}</span>
                    </Badge>
                    {installed?.build && (
                        <Badge size='sm' tone='neutral' variant='soft'>
                            build {installed.build}
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    );
}

function JavaRuntime({ startup, image }: { startup: SdkServerStartup | undefined; image: string }) {
    const { api } = useToolkit();
    const allowed = useServerPermission('startup.docker-image');
    const images = Object.entries(startup?.meta?.docker_images ?? {});
    const [busy, setBusy] = useState<string | null>(null);

    if (images.length < 2) return null;

    return (
        <Panel title='Java runtime' aside={<Coffee className='size-4 text-muted-foreground' aria-hidden />}>
            <div className='grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3'>
                {images.map(([label, value]) => {
                    const short = /(\d+)/.exec(label)?.[1] ?? label;
                    return (
                        <button
                            key={value}
                            type='button'
                            disabled={!allowed || busy !== null}
                            aria-pressed={value === image}
                            title={label}
                            onClick={async () => {
                                setBusy(value);
                                await attempt(
                                    () => api.setDockerImage(value),
                                    `Switched to ${label}. Restart to apply.`,
                                    toast
                                );
                                setBusy(null);
                            }}
                            className={cn(
                                'rounded-lg border px-2 py-2.5 text-center transition disabled:opacity-60',
                                value === image
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-muted/40 hover:bg-muted'
                            )}
                        >
                            <span className='block text-lg font-bold'>
                                {busy === value ? <Spinner size='small' /> : short}
                            </span>
                            <span className='block truncate text-[0.65rem] opacity-75'>
                                {short === label ? 'image' : 'Java'}
                            </span>
                        </button>
                    );
                })}
            </div>
            <p className='mt-3 text-xs text-muted-foreground'>
                Newer Minecraft needs newer Java. Restart after switching.
            </p>
        </Panel>
    );
}

export default function VersionsScreen() {
    const { server, id, api, installed, refresh } = useToolkit();
    const { data: startup } = useServerStartup(id);
    const running = useRunState(server.attributes.uuid);
    const jar = jarOf(startup);
    const [software, setSoftware] = useState<Provider['id']>('paper');
    const [version, setVersion] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [keepOld, setKeepOld] = useState(true);
    const [eula, setEula] = useState(true);
    const [step, setStep] = useState<string | null>(null);
    const provider = providerById(software)!;

    useEffect(() => {
        if (installed && providerById(installed.software)) setSoftware(installed.software as Provider['id']);
    }, [installed]);

    const versions = useQuery({
        queryKey: ['obsidian-mc', 'versions', software],
        queryFn: () => provider.versions(),
        staleTime: 10 * 60_000,
    });

    useEffect(() => setVersion(versions.data?.[0]?.versions[0] ?? null), [versions.data]);

    const families = versions.data ?? [];
    const shown = showAll ? families : families.slice(0, 4);
    const isCurrent = (v: string) => installed?.software === software && installed.version === v;

    const install = async () => {
        if (!version) return;
        try {
            setStep('Finding the newest build…');
            const download = await provider.resolve(version);
            const root = await api.listOrEmpty('/');
            if (keepOld && root.some((e) => e.name === jar)) {
                setStep(`Keeping the old jar as ${jar}.bak…`);
                await api.remove('/', [`${jar}.bak`]).catch(() => undefined);
                await api.rename('/', jar, `${jar}.bak`);
            } else if (root.some((e) => e.name === jar)) {
                await api.remove('/', [jar]);
            }
            setStep(`Downloading ${download.filename}…`);
            await api.install(download.url, '/', jar, { maxMb: server.attributes.upload_size });
            if (eula) await api.write('/eula.txt', 'eula=true\n');
            const marker: Installed = { software, version, build: download.build };
            await api.write(
                `/${MARKER}`,
                JSON.stringify({ ...marker, installedAt: new Date().toISOString() }, null, 2)
            );

            await api.setVariable('MINECRAFT_VERSION', version).catch(() => undefined);
            toast.success(
                `${provider.label} ${version} installed. ${running === 'offline' ? 'Start' : 'Restart'} the server to use it.`
            );
            void refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'The install failed.');
        } finally {
            setStep(null);
        }
    };

    return (
        <Page title='Versions' description='Switch to Paper, Purpur, Fabric and more, on any Minecraft version.'>
            <Current installed={installed} jar={jar} running={running} />
            <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]'>
                <div className='min-w-0'>
                    <Step n={1}>Software</Step>
                    <div className='grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-3'>
                        {providers.map((p) => (
                            <button
                                key={p.id}
                                type='button'
                                aria-pressed={software === p.id}
                                onClick={() => setSoftware(p.id)}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                                    software === p.id
                                        ? 'border-foreground/30 bg-muted'
                                        : 'border-border bg-card hover:bg-muted/50'
                                )}
                            >
                                <span className='grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-background'>
                                    <SoftwareLogo software={p.id} className='size-4' />
                                </span>
                                <span className='min-w-0'>
                                    <span className='flex items-center gap-2 text-sm font-bold'>
                                        {p.label}
                                        {installed?.software === p.id && (
                                            <Badge size='sm' tone='neutral' variant='soft'>
                                                Current
                                            </Badge>
                                        )}
                                    </span>
                                    <span className='hidden truncate text-xs text-muted-foreground sm:block'>
                                        {p.blurb}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className='mt-7'>
                        <Step n={2}>Version</Step>
                        <div className='rounded-xl border border-border bg-card p-4'>
                            {versions.isLoading && <Spinner centered />}
                            {versions.isError && (
                                <p className='text-sm text-destructive'>
                                    Could not load {provider.label} versions. {(versions.error as Error).message}
                                </p>
                            )}
                            <div className='flex flex-col gap-3'>
                                {shown.map((family) => (
                                    <div
                                        key={family.name}
                                        className='grid grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3'
                                    >
                                        <span className='pt-1.5 font-mono text-xs text-muted-foreground'>
                                            {family.name}
                                        </span>
                                        <div className='flex flex-wrap gap-1.5'>
                                            {family.versions.map((v) => (
                                                <button
                                                    key={v}
                                                    type='button'
                                                    aria-pressed={version === v}
                                                    onClick={() => setVersion(v)}
                                                    className={cn(
                                                        'relative rounded-full border px-3 py-1 font-mono text-xs transition',
                                                        version === v
                                                            ? 'border-primary bg-primary text-primary-foreground'
                                                            : 'border-border hover:bg-muted'
                                                    )}
                                                >
                                                    {v}
                                                    {isCurrent(v) && (
                                                        <span
                                                            className='absolute -top-0.5 -right-0.5 size-2 rounded-full bg-success'
                                                            aria-label='installed'
                                                        />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {families.length > 4 && (
                                <button
                                    type='button'
                                    onClick={() => setShowAll(!showAll)}
                                    className='mt-4 text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground'
                                >
                                    {showAll ? 'Show fewer' : `Show ${families.length - 4} older families`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                <div className='flex flex-col gap-4'>
                    <Panel title='Install plan'>
                        <div className='grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2'>
                            <div className='rounded-lg border border-border bg-muted/40 p-3 text-center'>
                                <p className='truncate text-sm font-bold'>
                                    {installed
                                        ? installed.software === 'unknown'
                                            ? 'Not detected'
                                            : softwareLabel[installed.software]
                                        : '...'}
                                </p>
                                <p className='font-mono text-xs text-muted-foreground'>{installed?.version ?? '?'}</p>
                            </div>
                            <ArrowRight className='size-4 text-muted-foreground' aria-hidden />
                            <div className='rounded-lg border border-success/50 bg-success/8 p-3 text-center'>
                                <p className='truncate text-sm font-bold'>{provider.label}</p>
                                <p className='font-mono text-xs text-muted-foreground'>{version ?? '…'}</p>
                            </div>
                        </div>
                        {running !== 'offline' && (
                            <p className='mt-4 flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning'>
                                <TriangleAlert className='size-4 shrink-0' aria-hidden />
                                Stop the server first. Swapping the jar while it runs can corrupt worlds.
                            </p>
                        )}
                        <dl className='mt-4 flex flex-col gap-4 text-sm'>
                            <div className='flex items-center justify-between gap-3'>
                                <dt>
                                    Jar file
                                    <span className='block text-xs text-muted-foreground'>From startup settings</span>
                                </dt>
                                <dd className='rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs'>
                                    {jar}
                                </dd>
                            </div>
                            <Switch
                                checked={keepOld}
                                onChange={() => setKeepOld(!keepOld)}
                                label='Keep the old jar'
                                description='Renamed to .bak, not deleted'
                                controlPosition='end'
                            />
                            <Switch
                                checked={eula}
                                onChange={() => setEula(!eula)}
                                label='Accept the EULA'
                                description='You agree to the Minecraft EULA (aka.ms/MinecraftEULA)'
                                controlPosition='end'
                            />
                        </dl>
                        <Button
                            size='xlarge'
                            className='mt-5'
                            disabled={!version || step !== null || running === 'running' || running === 'starting'}
                            isLoading={step !== null}
                            onClick={install}
                        >
                            Install {provider.label} {version ?? ''}
                        </Button>
                        <p className='mt-3 text-xs text-muted-foreground'>
                            {step ?? 'Always the newest stable build. Downloads go straight to the server.'}
                        </p>
                    </Panel>
                    <JavaRuntime startup={startup} image={server.attributes.docker_image} />
                </div>
            </div>
        </Page>
    );
}
