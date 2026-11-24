import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, Download, Package } from 'lucide-react';
import { Badge, Button, Dialog, Spinner, cn, toast } from '@pterodactyl/sdk';
import { isModded, softwareLabel } from '../lib/minecraft';
import { itemKeys, kitItemDownload, kits, type Kit, type KitItem } from '../lib/kits';
import { looksInstalled } from '../lib/sources';
import { useDirectory, useToolkit } from '../lib/useToolkit';
import Page, { Eyebrow } from '../ui/Page';

type ItemState = 'waiting' | 'installing' | 'done' | 'skipped' | 'failed';

const tones: Record<Kit['tone'], string> = {
    success: 'bg-success/12 text-success',
    info: 'bg-chart-2/15 text-chart-2',
    accent: 'bg-chart-4/15 text-chart-4',
    warning: 'bg-warning/12 text-warning',
    danger: 'bg-destructive/12 text-destructive',
    neutral: 'bg-muted text-muted-foreground',
};

/** Installs a kit item by item, skipping what is already there, and shows each one's progress. */
function InstallDialog({ kit, onClose }: { kit: Kit; onClose: () => void }) {
    const { api, id, loaders, gameVersion } = useToolkit();
    const client = useQueryClient();
    const folder = useDirectory('/plugins');
    const names = (folder.data ?? []).map((e) => e.name);
    const [states, setStates] = useState<Record<string, ItemState>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [running, setRunning] = useState(false);
    const finished = Object.keys(states).length === kit.items.length && !running;

    const run = async () => {
        setRunning(true);
        await api.mkdir('/', 'plugins').catch(() => undefined);
        const set = (item: KitItem, state: ItemState) => setStates((s) => ({ ...s, [item.name]: state }));

        for (const item of kit.items) {
            if (looksInstalled(names, ...itemKeys(item))) {
                set(item, 'skipped');
                continue;
            }
            set(item, 'installing');
            try {
                const file = await kitItemDownload(item, loaders, gameVersion);
                await api.pull(file.url, '/plugins', file.filename);
                set(item, 'done');
            } catch (error) {
                set(item, 'failed');
                setErrors((e) => ({ ...e, [item.name]: error instanceof Error ? error.message : 'Failed' }));
            }
        }
        await client.invalidateQueries({ queryKey: ['obsidian-mc', id, 'dir', '/plugins'] });
        setRunning(false);
        toast.success(`${kit.name} is installed. Restart the server to load it.`);
    };

    return (
        <Dialog open onClose={running ? () => undefined : onClose} title={`Install ${kit.name}`}>
            <p className='text-sm text-muted-foreground'>{kit.description}</p>
            <ul className='mt-4 flex flex-col gap-1.5'>
                {kit.items.map((item) => {
                    const state = states[item.name] ?? (looksInstalled(names, ...itemKeys(item)) ? 'skipped' : 'waiting');
                    return (
                        <li key={item.name} className='flex items-center gap-3 rounded-lg border border-border px-3 py-2'>
                            <Package className='size-4 text-muted-foreground' aria-hidden />
                            <span className='min-w-0 flex-1'>
                                <span className='block text-sm font-medium'>{item.name}</span>
                                {errors[item.name] && <span className='block text-xs text-destructive'>{errors[item.name]}</span>}
                            </span>
                            <span className='text-xs text-muted-foreground'>
                                {state === 'installing' && <Spinner size='small' />}
                                {state === 'done' && <Check className='size-4 text-success' aria-label='Installed' />}
                                {state === 'failed' && <CircleAlert className='size-4 text-destructive' aria-label='Failed' />}
                                {state === 'skipped' && 'Already here'}
                                {state === 'waiting' && item.source}
                            </span>
                        </li>
                    );
                })}
            </ul>
            <Dialog.Footer>
                <Button color='grey' onClick={onClose} disabled={running}>
                    {finished ? 'Close' : 'Cancel'}
                </Button>
                {!finished && (
                    <Button onClick={run} isLoading={running} disabled={running}>
                        <Download className='size-4' aria-hidden /> Install
                    </Button>
                )}
            </Dialog.Footer>
        </Dialog>
    );
}

/** Hand-picked plugin bundles, matched to the server's version. Plugins already installed are skipped. */
export default function KitsScreen() {
    const { installed, gameVersion } = useToolkit();
    const folder = useDirectory('/plugins');
    const names = (folder.data ?? []).map((e) => e.name);
    const [open, setOpen] = useState<Kit | null>(null);
    const modded = installed ? isModded(installed.software) : false;

    return (
        <Page title='Kits' description='Hand-picked plugin bundles to get a new server going fast.'>
            <p className='text-sm text-muted-foreground'>
                Matched to {installed ? softwareLabel[installed.software] : '…'} {gameVersion ?? ''}. Already installed plugins are skipped.
            </p>
            {modded && (
                <p className='text-sm text-warning'>Kits install plugins, and this server loads mods. Switch to Paper or Purpur first.</p>
            )}
            <ul className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {kits.map((kit) => {
                    const here = kit.items.filter((item) => looksInstalled(names, ...itemKeys(item))).length;
                    return (
                        <li key={kit.id}>
                            <button
                                type='button'
                                disabled={modded}
                                onClick={() => setOpen(kit)}
                                className='flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-foreground/20 disabled:opacity-50'
                            >
                                <span className={cn('self-start rounded-md px-2 py-1 text-[0.62rem] font-bold tracking-[0.08em] uppercase', tones[kit.tone])}>
                                    {kit.eyebrow}
                                </span>
                                <span className='text-lg font-bold tracking-tight'>{kit.name}</span>
                                <span className='flex-1 text-sm text-muted-foreground'>{kit.description}</span>
                                <span className='flex flex-wrap items-center gap-1.5'>
                                    {kit.items.map((item) => (
                                        <Badge key={item.name} size='sm' tone={looksInstalled(names, ...itemKeys(item)) ? 'success' : 'neutral'} variant='soft'>
                                            {item.name}
                                        </Badge>
                                    ))}
                                </span>
                                <Eyebrow className='normal-case tracking-normal'>
                                    {kit.items.length} plugins{here > 0 && ` · ${here} already here`}
                                </Eyebrow>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {open && <InstallDialog kit={open} onClose={() => setOpen(null)} />}
        </Page>
    );
}
