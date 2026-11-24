import { useState } from 'react';
import { Archive, Check, Download, FileBox, Globe2, Map as MapIcon } from 'lucide-react';
import { Alert, Button, Switch, cn, toast } from '@pterodactyl/sdk';
import { safeName } from '../lib/api';
import { useToolkit } from '../lib/useToolkit';
import Page, { Panel, Step } from '../ui/Page';

type Preset = 'world' | 'datapack' | 'plugin' | 'file';

const PRESETS: Record<Preset, { label: string; help: string; icon: typeof Globe2; directory: string; extract: boolean }> = {
    world: { label: 'World', help: 'A zipped world. The current world is kept as a backup folder.', icon: MapIcon, directory: '/', extract: true },
    datapack: { label: 'Datapack', help: 'A datapack zip, dropped into the world’s datapacks folder.', icon: FileBox, directory: '/world/datapacks', extract: false },
    plugin: { label: 'Plugin jar', help: 'A plugin jar from any direct link.', icon: Archive, directory: '/plugins', extract: false },
    file: { label: 'Any file', help: 'Any file or archive, into the folder you choose.', icon: Globe2, directory: '/', extract: true },
};

const ARCHIVE = /\.(zip|tar|tar\.gz|tgz|tar\.xz|7z|rar)$/i;

/** The file name a URL points at, for the pulled file. */
export function fileNameOf(url: string): string {
    try {
        const last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
        return safeName(last || 'import');
    } catch {
        return 'import';
    }
}

/** Bring a world, datapack, plugin or archive onto the server from a link; Wings downloads it directly. */
export default function ImporterScreen() {
    const { api } = useToolkit();
    const [preset, setPreset] = useState<Preset>('world');
    const [url, setUrl] = useState('');
    const [directory, setDirectory] = useState(PRESETS.world.directory);
    const [extract, setExtract] = useState(true);
    const [cleanup, setCleanup] = useState(true);
    const [log, setLog] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);

    let valid = false;
    try {
        valid = ['http:', 'https:'].includes(new URL(url).protocol);
    } catch {
        valid = false;
    }
    const name = valid ? fileNameOf(url) : '';
    const archive = ARCHIVE.test(name);

    const choose = (p: Preset) => {
        setPreset(p);
        setDirectory(PRESETS[p].directory);
        setExtract(PRESETS[p].extract);
    };

    const run = async () => {
        setBusy(true);
        setLog([]);
        const say = (line: string) => setLog((l) => [...l, line]);
        try {
            const target = directory.replace(/\/+$/, '') || '/';
            if (preset === 'world') {
                const root = await api.listOrEmpty('/');
                if (root.some((e) => e.name === 'world')) {
                    const backup = `world-before-import-${new Date().toISOString().slice(0, 10)}`;
                    say(`Keeping the current world as ${backup}…`);
                    await api.rename('/', 'world', backup);
                }
            } else if (target !== '/') {
                const parent = target.split('/').slice(0, -1).join('/') || '/';
                await api.mkdir(parent, target.split('/').pop()!).catch(() => undefined);
            }
            say(`Downloading ${name} into ${target}…`);
            await api.pull(url, target, name);
            if (extract && archive) {
                say(`Extracting ${name}…`);
                await api.decompress(target, name);
                if (cleanup) {
                    await api.remove(target, [name]);
                    say('Removed the archive.');
                }
            }
            say('Done.');
            toast.success(`Imported ${name}.${preset === 'world' ? ' Check the world folder is named "world", then start the server.' : ''}`);
        } catch (error) {
            say(error instanceof Error ? error.message : 'The import failed.');
            toast.error('The import failed. See the log on the page.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Page title='Importer' description='Bring worlds, datapacks, plugins and archives in from a link.'>
            <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]'>
                <div className='flex flex-col gap-6'>
                    <div>
                        <Step n={1}>What are you importing?</Step>
                        <div className='grid grid-cols-2 gap-2.5 md:grid-cols-4'>
                            {(Object.keys(PRESETS) as Preset[]).map((p) => {
                                const { label, icon: Glyph } = PRESETS[p];
                                return (
                                    <button
                                        key={p}
                                        type='button'
                                        aria-pressed={preset === p}
                                        onClick={() => choose(p)}
                                        className={cn(
                                            'flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition',
                                            preset === p ? 'border-foreground/30 bg-muted' : 'border-border bg-card hover:bg-muted/50'
                                        )}
                                    >
                                        <Glyph className='size-5' aria-hidden />
                                        <span className='text-sm font-bold'>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className='mt-2 text-sm text-muted-foreground'>{PRESETS[preset].help}</p>
                    </div>
                    <div>
                        <Step n={2}>Direct download link</Step>
                        <input
                            value={url}
                            onChange={(e) => setUrl(e.target.value.trim())}
                            placeholder='https://example.com/my-world.zip'
                            aria-label='Download link'
                            className='h-12 w-full rounded-xl border border-input-border bg-input px-4 font-mono text-sm'
                        />
                        <p className='mt-2 text-xs text-muted-foreground'>
                            The server downloads it itself, so the link must be public. Google Drive and Dropbox need their direct-download form.
                        </p>
                    </div>
                    <div>
                        <Step n={3}>Where it goes</Step>
                        <input
                            value={directory}
                            onChange={(e) => setDirectory(e.target.value)}
                            aria-label='Target folder'
                            disabled={preset === 'world'}
                            className='h-10 w-full rounded-lg border border-input-border bg-input px-3 font-mono text-sm disabled:opacity-60'
                        />
                    </div>
                </div>
                <Panel title='Import'>
                    <dl className='flex flex-col gap-3 text-sm'>
                        <div className='flex justify-between gap-3'>
                            <dt className='text-muted-foreground'>File</dt>
                            <dd className='truncate font-mono text-xs'>{name || '—'}</dd>
                        </div>
                        <div className='flex justify-between gap-3'>
                            <dt className='text-muted-foreground'>Into</dt>
                            <dd className='truncate font-mono text-xs'>{directory}</dd>
                        </div>
                    </dl>
                    <div className='mt-4 flex flex-col gap-3'>
                        <Switch
                            checked={extract && archive}
                            disabled={!archive}
                            onChange={() => setExtract(!extract)}
                            label='Extract the archive'
                            description={archive ? 'Unpacked where it lands' : 'Only for zip and tar files'}
                            controlPosition='end'
                        />
                        <Switch
                            checked={cleanup}
                            disabled={!extract || !archive}
                            onChange={() => setCleanup(!cleanup)}
                            label='Delete the archive after'
                            controlPosition='end'
                        />
                    </div>
                    {preset === 'world' && (
                        <Alert type='warning' className='mt-4'>
                            Stop the server first. The current world is renamed, not deleted.
                        </Alert>
                    )}
                    <Button size='xlarge' className='mt-5' disabled={!valid || busy} isLoading={busy} onClick={run}>
                        <Download className='size-4' aria-hidden /> Import
                    </Button>
                    {log.length > 0 && (
                        <ol className='mt-4 flex flex-col gap-1 rounded-lg bg-terminal p-3 font-mono text-xs text-terminal-foreground'>
                            {log.map((line, i) => (
                                <li key={i} className='flex gap-2'>
                                    {line === 'Done.' ? <Check className='size-3.5 text-success' aria-hidden /> : <span aria-hidden>›</span>}
                                    {line}
                                </li>
                            ))}
                        </ol>
                    )}
                </Panel>
            </div>
        </Page>
    );
}
