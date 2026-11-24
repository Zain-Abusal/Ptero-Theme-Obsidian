import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Archive,
    CircleCheck,
    Download,
    Earth,
    Flame,
    Map as MapIcon,
    Moon,
    Play,
    RotateCcw,
    TriangleAlert,
} from 'lucide-react';
import {
    Alert,
    Badge,
    Button,
    Checkbox,
    Dialog,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    PanelLink,
    Spinner,
    toast,
    useServerResources,
} from '@pterodactyl/sdk';
import { parseProperties, serializeProperties } from '../lib/properties';
import { looksInstalled } from '../lib/sources';
import { useDirectory, useToolkit } from '../lib/useToolkit';
import { asideName, compress, downloadUrl, findWorlds, type World } from '../lib/worlds';
import Page, { Panel, attempt } from '../ui/Page';

function useRunning(uuid: string) {
    const { data } = useServerResources(uuid, (r) => r);
    const state = (data as unknown as { attributes?: { current_state?: string } } | undefined)?.attributes
        ?.current_state;
    return state !== undefined && state !== 'offline' && state !== 'stopped';
}

function Pregenerate({ world, running }: { world: string; running: boolean }) {
    const { api, id } = useToolkit();
    const plugins = useDirectory('/plugins');
    const [radius, setRadius] = useState(3000);
    const has = looksInstalled(
        (plugins.data ?? []).map((e) => e.name),
        'chunky'
    );

    if (!has) {
        return (
            <p className='text-sm text-muted-foreground'>
                Install{' '}
                <PanelLink
                    destination={{ to: '/server/$id/mc/plugins' as '/server/$id', params: { id } }}
                    className='font-semibold text-foreground'
                >
                    Chunky from Plugins
                </PanelLink>{' '}
                to generate chunks ahead of time, so exploring does not lag.
            </p>
        );
    }

    const send = async (commands: string[], done: string) =>
        attempt(
            async () => {
                for (const command of commands) await api.command(command);
            },
            done,
            toast
        );

    return (
        <div className='flex flex-col gap-3'>
            <label className='flex items-center justify-between gap-3 text-sm'>
                Radius
                <span className='flex items-center gap-2'>
                    <input
                        type='number'
                        min={100}
                        max={50000}
                        step={100}
                        value={radius}
                        onChange={(e) => setRadius(Number(e.target.value))}
                        className='h-9 w-24 rounded-lg border border-input-border bg-input px-2 text-right font-mono text-sm'
                    />
                    <span className='text-xs text-muted-foreground'>blocks</span>
                </span>
            </label>
            <div className='flex flex-wrap gap-2'>
                <Button
                    size='small'
                    disabled={!running || radius < 100}
                    onClick={() =>
                        send(
                            [`chunky world ${world}`, `chunky radius ${radius}`, 'chunky start'],
                            `Generating ${world} out to ${radius} blocks. Progress shows in the console.`
                        )
                    }
                >
                    <Play className='size-3.5' aria-hidden /> Start
                </Button>
                <Button size='small' color='grey' disabled={!running} onClick={() => send(['chunky pause'], 'Paused.')}>
                    Pause
                </Button>
                <Button
                    size='small'
                    color='grey'
                    disabled={!running}
                    onClick={() => send(['chunky continue'], 'Continuing.')}
                >
                    Continue
                </Button>
            </div>
            {!running && <p className='text-xs text-muted-foreground'>Start the server to pre-generate.</p>}
        </div>
    );
}

export default function WorldsScreen() {
    const { server, id, api } = useToolkit();
    const client = useQueryClient();
    const running = useRunning(server.attributes.uuid);
    const [busy, setBusy] = useState<string | null>(null);
    const [resetting, setResetting] = useState<World | null>(null);
    const [hardDelete, setHardDelete] = useState(false);

    const data = useQuery({
        queryKey: ['obsidian-mc', id, 'worlds'],
        queryFn: async () => {
            const raw = (await api.readOrNull('/server.properties')) ?? '';
            const props = parseProperties(raw);
            const level = props.values['level-name'] || 'world';
            return { props, level, seed: props.values['level-seed'] ?? '', worlds: await findWorlds(api, level) };
        },
        staleTime: 30_000,
    });
    const refresh = () => client.invalidateQueries({ queryKey: ['obsidian-mc', id] });

    const run = async (key: string, work: () => Promise<unknown>, done: string) => {
        setBusy(key);
        await attempt(work, done, toast);
        await refresh();
        setBusy(null);
    };

    const activate = (world: World) =>
        run(
            `active:${world.name}`,
            () =>
                api.write(
                    '/server.properties',
                    serializeProperties(data.data!.props, { ...data.data!.props.values, 'level-name': world.name })
                ),
            `${world.name} loads on the next start.`
        );

    const archive = (world: World) => compress(id, [world.name, ...world.dimensions.map((d) => `${world.name}_${d}`)]);

    const download = (world: World) =>
        run(
            `download:${world.name}`,
            async () => {
                const name = await archive(world);
                window.open(await downloadUrl(id, `/${name}`), '_blank', 'noopener');
            },
            'Archive ready; your download is starting. The archive stays in the server root.'
        );

    const reset = async (world: World) => {
        const folders = [world.name, ...world.dimensions.map((d) => `${world.name}_${d}`)];
        await run(
            `reset:${world.name}`,
            async () => {
                if (hardDelete) await api.remove('/', folders);
                else for (const folder of folders) await api.rename('/', folder, asideName(folder));
            },
            hardDelete
                ? `${world.name} deleted. A fresh world generates on the next start.`
                : `${world.name} set aside. A fresh world generates on the next start.`
        );
        setResetting(null);
        setHardDelete(false);
    };

    const worlds = data.data?.worlds ?? [];
    const level = data.data?.level;

    return (
        <Page title='Worlds' description='Switch, back up, download, reset and pre-generate your worlds.'>
            {running && (
                <Alert type='warning'>
                    <span className='flex items-center gap-2'>
                        <TriangleAlert className='size-4 shrink-0' aria-hidden />
                        Stop the server before switching, backing up or resetting a world. Minecraft keeps writing to it
                        while it runs.
                    </span>
                </Alert>
            )}
            {data.isLoading && <Spinner size='large' centered />}
            {data.isError && <Alert type='danger'>Could not read the server's files.</Alert>}
            {!data.isLoading && worlds.length === 0 && (
                <Empty className='rounded-xl border border-border py-10'>
                    <EmptyHeader>
                        <EmptyMedia variant='icon'>
                            <Earth />
                        </EmptyMedia>
                        <EmptyTitle>No worlds yet</EmptyTitle>
                        <EmptyDescription>
                            Start the server once and Minecraft creates "{level ?? 'world'}". Or bring one in with the
                            Importer.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
            <ul className='grid gap-4 xl:grid-cols-2'>
                {worlds.map((world) => {
                    const active = world.name === level;
                    return (
                        <li
                            key={world.name}
                            className='flex flex-col gap-4 rounded-xl border border-border bg-card p-5'
                        >
                            <div className='flex items-start gap-3'>
                                <span className='grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-muted'>
                                    <MapIcon className='size-5' aria-hidden />
                                </span>
                                <div className='min-w-0 flex-1'>
                                    <p className='flex flex-wrap items-center gap-2'>
                                        <span className='truncate text-lg font-bold tracking-tight'>{world.name}</span>
                                        {active && (
                                            <Badge size='sm' tone='success' variant='soft'>
                                                <CircleCheck className='size-3' aria-hidden /> Active
                                            </Badge>
                                        )}
                                    </p>
                                    <p className='mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground'>
                                        <span className='rounded-md border border-border px-1.5 py-0.5'>Overworld</span>
                                        {world.dimensions.includes('nether') && (
                                            <span className='flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5'>
                                                <Flame className='size-3' aria-hidden /> Nether
                                            </span>
                                        )}
                                        {world.dimensions.includes('the_end') && (
                                            <span className='flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5'>
                                                <Moon className='size-3' aria-hidden /> The End
                                            </span>
                                        )}
                                    </p>
                                    {active && data.data?.seed && (
                                        <p className='mt-2 truncate font-mono text-xs text-muted-foreground'>
                                            seed {data.data.seed}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className='flex flex-wrap gap-2'>
                                {!active && (
                                    <Button
                                        size='small'
                                        onClick={() => activate(world)}
                                        isLoading={busy === `active:${world.name}`}
                                        disabled={busy !== null}
                                    >
                                        Make active
                                    </Button>
                                )}
                                <Button
                                    size='small'
                                    color='grey'
                                    onClick={() => download(world)}
                                    isLoading={busy === `download:${world.name}`}
                                    disabled={busy !== null}
                                >
                                    <Download className='size-3.5' aria-hidden /> Download
                                </Button>
                                <Button
                                    size='small'
                                    color='grey'
                                    onClick={() =>
                                        run(
                                            `backup:${world.name}`,
                                            () => archive(world),
                                            `Backed up ${world.name} to an archive in the server root.`
                                        )
                                    }
                                    isLoading={busy === `backup:${world.name}`}
                                    disabled={busy !== null}
                                >
                                    <Archive className='size-3.5' aria-hidden /> Back up
                                </Button>
                                <Button
                                    size='small'
                                    color='red'
                                    onClick={() => setResetting(world)}
                                    disabled={busy !== null}
                                >
                                    <RotateCcw className='size-3.5' aria-hidden /> Reset
                                </Button>
                            </div>
                            {active && (
                                <Panel title='Pre-generate' className='bg-background/40'>
                                    <Pregenerate world={world.name} running={running} />
                                </Panel>
                            )}
                        </li>
                    );
                })}
            </ul>
            <Dialog
                open={resetting !== null}
                onClose={() => {
                    setResetting(null);
                    setHardDelete(false);
                }}
                title={`Reset ${resetting?.name ?? ''}?`}
            >
                <p className='text-sm text-muted-foreground'>
                    A fresh world generates on the next start
                    {resetting?.name === level && data.data?.seed ? ` from seed ${data.data.seed}` : ''}. By default the
                    old one is renamed to{' '}
                    <code className='font-mono'>{resetting ? asideName(resetting.name) : ''}</code>, so you can bring it
                    back.
                </p>
                <label className='mt-4 flex items-center gap-2 text-sm'>
                    <Checkbox checked={hardDelete} onChange={setHardDelete} />
                    Delete it for good instead
                </label>
                <Dialog.Footer>
                    <Button color='grey' onClick={() => setResetting(null)}>
                        Cancel
                    </Button>
                    <Button
                        color='red'
                        onClick={() => resetting && reset(resetting)}
                        isLoading={busy?.startsWith('reset:')}
                        disabled={running}
                    >
                        {hardDelete ? 'Delete and reset' : 'Reset'}
                    </Button>
                </Dialog.Footer>
            </Dialog>
        </Page>
    );
}
