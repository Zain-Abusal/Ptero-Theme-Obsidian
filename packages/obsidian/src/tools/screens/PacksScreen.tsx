import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, TriangleAlert } from 'lucide-react';
import { Alert, Button, Dialog, toast, useServerResources, useServerStartup } from '@pterodactyl/sdk';
import { useObsidian } from '../../lib/settings';
import { installCurseForgePack, installModrinthPack } from '../lib/modpack';
import { parseProperties, serializeProperties } from '../lib/properties';
import { jarOf } from '../lib/software';
import { modrinthDownload, type Project, type Source } from '../lib/sources';
import { useToolkit } from '../lib/useToolkit';
import Page, { Segmented } from '../ui/Page';
import { Browser } from './BrowserScreen';

type Tab = 'modpack' | 'datapack' | 'resourcepack';

/** The world folder, from server.properties' level-name. */
function useLevelName() {
    const { id, api } = useToolkit();
    return useQuery({
        queryKey: ['obsidian-mc', id, 'level-name'],
        queryFn: async () => {
            const raw = await api.readOrNull('/server.properties');
            const name = raw ? parseProperties(raw).values['level-name'] : undefined;
            return name?.trim() || 'world';
        },
        staleTime: 60_000,
    });
}

function useRunning(uuid: string) {
    const { data } = useServerResources(uuid, (r) => r);
    const state = (data as unknown as { attributes?: { current_state?: string } } | undefined)?.attributes?.current_state;
    return state === 'running' || state === 'starting' || state === 'stopping';
}

/** Confirms, then installs a modpack with a live log. */
function PackDialog({ project, source, onClose }: { project: Project; source: Source; onClose: () => void }) {
    const { api, id, server, gameVersion, refresh } = useToolkit();
    const { curseforgeKey } = useObsidian();
    const { data: startup } = useServerStartup(id);
    const client = useQueryClient();
    const running = useRunning(server.attributes.uuid);
    const [log, setLog] = useState<string[]>([]);
    const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
    const [done, setDone] = useState(0);

    const start = async () => {
        setState('busy');
        setLog([]);
        const ctx = {
            api,
            maxMb: server.attributes.upload_size,
            jar: jarOf(startup),
            log: (line: string) => setLog((l) => [...l, line]),
            onFile: () => setDone((n) => n + 1),
        };
        try {
            if (source === 'curseforge') await installCurseForgePack(ctx, curseforgeKey, project.id, project.page, null);
            else {
                const summary = await installModrinthPack(ctx, project.id, gameVersion);
                if (summary.failed.length) throw new Error(`${summary.failed.length} files could not be downloaded; see the log.`);
            }
            setState('done');
            toast.success(`${project.title} is installed. Start the server to play it.`);
        } catch (error) {
            ctx.log(`✗ ${error instanceof Error ? error.message : String(error)}`);
            setState('failed');
            toast.error('The modpack did not finish installing. See the log.');
        } finally {
            void refresh();
            void client.invalidateQueries({ queryKey: ['obsidian-mc', id] });
        }
    };

    return (
        <Dialog open onClose={state === 'busy' ? () => undefined : onClose} title={`Install ${project.title}`}>
            {state === 'idle' && (
                <div className='flex flex-col gap-3 text-sm'>
                    <p className='text-muted-foreground'>
                        This downloads the pack’s mods and configs into the server and replaces files with the same names. Worlds are not touched.
                    </p>
                    {running && (
                        <p className='flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning'>
                            <TriangleAlert className='size-4 shrink-0' aria-hidden />
                            Stop the server first. Replacing mods while it runs can corrupt worlds.
                        </p>
                    )}
                    <p className='text-xs text-muted-foreground'>Take a backup first if the server already has mods you want to keep.</p>
                </div>
            )}
            {state !== 'idle' && (
                <ol
                    aria-live='polite'
                    className='flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg bg-terminal p-3 font-mono text-xs text-terminal-foreground'
                >
                    {log.map((line, i) => (
                        <li key={i} className='flex gap-2'>
                            {line.startsWith('✗') ? (
                                <CircleAlert className='size-3.5 shrink-0 text-destructive' aria-hidden />
                            ) : line === 'Done.' || line.startsWith('Done.') ? (
                                <Check className='size-3.5 shrink-0 text-success' aria-hidden />
                            ) : (
                                <span aria-hidden>›</span>
                            )}
                            <span className='min-w-0 break-words'>{line.replace(/^✗ /, '')}</span>
                        </li>
                    ))}
                    {state === 'busy' && done > 0 && <li className='text-muted-foreground'>{done} files so far…</li>}
                </ol>
            )}
            <Dialog.Footer>
                <Button color='grey' onClick={onClose} disabled={state === 'busy'}>
                    {state === 'idle' ? 'Cancel' : 'Close'}
                </Button>
                {state === 'idle' && (
                    <Button onClick={start} disabled={running}>
                        Install pack
                    </Button>
                )}
            </Dialog.Footer>
        </Dialog>
    );
}

/** Modpacks, datapacks and resource packs from Modrinth (and CurseForge for modpacks). */
export default function PacksScreen() {
    const { api, id, gameVersion } = useToolkit();
    const client = useQueryClient();
    const level = useLevelName();
    const [tab, setTab] = useState<Tab>('modpack');
    const [pack, setPack] = useState<{ project: Project; source: Source } | null>(null);

    const setServerPack = async (project: Project) => {
        const file = await modrinthDownload(project.id, ['minecraft'], gameVersion);
        const raw = (await api.readOrNull('/server.properties')) ?? '';
        const props = parseProperties(raw);
        await api.write(
            '/server.properties',
            serializeProperties(props, { ...props.values, 'resource-pack': file.url, 'resource-pack-sha1': file.sha1 ?? '' })
        );
        await client.invalidateQueries({ queryKey: ['obsidian-mc', id, 'properties'] });
        toast.success(`${project.title} is now the server resource pack. Restart to apply.`);
    };

    return (
        <Page title='Packs' description='Modpacks, datapacks and resource packs, installed in one click.'>
            <Segmented
                label='Pack type'
                value={tab}
                onChange={setTab}
                options={[
                    { value: 'modpack', label: 'Modpacks' },
                    { value: 'datapack', label: 'Datapacks' },
                    { value: 'resourcepack', label: 'Resource packs' },
                ]}
                className='self-start'
            />
            {tab === 'modpack' && (
                <>
                    <Alert type='info'>
                        Fabric packs are installed completely, loader included. Forge, NeoForge and Quilt packs get their mods and configs; install
                        the loader with a matching egg.
                    </Alert>
                    <Browser
                        key='modpack'
                        kind='modpack'
                        action={{ label: 'Install pack', run: async (project, source) => setPack({ project, source }) }}
                    />
                </>
            )}
            {tab === 'datapack' && level.data && <Browser key='datapack' kind='datapack' directory={`/${level.data}/datapacks`} />}
            {tab === 'resourcepack' && (
                <>
                    <p className='text-sm text-muted-foreground'>
                        A server resource pack is offered to every player who joins. The server links to Modrinth’s copy, with its checksum.
                    </p>
                    <Browser key='resourcepack' kind='resourcepack' action={{ label: 'Use as server pack', run: setServerPack }} />
                </>
            )}
            {pack && <PackDialog project={pack.project} source={pack.source} onClose={() => setPack(null)} />}
        </Page>
    );
}
