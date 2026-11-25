import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Check,
    ChevronDown,
    CircleAlert,
    DoorOpen,
    Download,
    MessagesSquare,
    Package,
    Paintbrush,
    Pickaxe,
    ShieldCheck,
    Smartphone,
    type LucideIcon,
} from 'lucide-react';
import { Alert, Button, Dialog, Spinner, cn, toast } from '@pterodactyl/sdk';
import { isModded, softwareLabel } from '../lib/minecraft';
import { itemKeys, kitItemDownload, kits, type Kit, type KitItem } from '../lib/kits';
import { looksInstalled } from '../lib/sources';
import { useDirectory, useToolkit } from '../lib/useToolkit';
import Page from '../ui/Page';
import Collapse from '../../ui/Collapse';

type ItemState = 'waiting' | 'installing' | 'done' | 'skipped' | 'failed';

function InstallDialog({ kit, onClose }: { kit: Kit; onClose: () => void }) {
    const { api, id, server, loaders, gameVersion } = useToolkit();
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

        const resolved: { item: KitItem; url: string; filename: string }[] = [];
        for (const item of kit.items) {
            if (looksInstalled(names, ...itemKeys(item))) {
                set(item, 'skipped');
                continue;
            }
            set(item, 'installing');
            try {
                resolved.push({ item, ...(await kitItemDownload(item, loaders, gameVersion)) });
            } catch (error) {
                set(item, 'failed');
                setErrors((e) => ({ ...e, [item.name]: error instanceof Error ? error.message : 'Failed' }));
            }
        }
        const byFile = new Map(resolved.map((r) => [r.filename, r.item]));
        const summary = await api.installMany(
            resolved.map((r) => ({ url: r.url, directory: '/plugins', filename: r.filename })),
            {
                maxMb: server.attributes.upload_size,
                onFile: (file, result, error) => {
                    const item = byFile.get(file.filename);
                    if (!item) return;
                    set(item, result === 'failed' ? 'failed' : 'done');
                    if (error) setErrors((e) => ({ ...e, [item.name]: error }));
                },
            }
        );
        await client.invalidateQueries({ queryKey: ['obsidian-mc', id, 'dir', '/plugins'] });
        setRunning(false);
        if (summary.failed.length)
            toast.error(`${summary.failed.length} plugins in ${kit.name} could not be installed.`);
        else toast.success(`${kit.name} is installed. Restart the server to load it.`);
    };

    return (
        <Dialog open onClose={running ? () => undefined : onClose} title={`Install ${kit.name}`}>
            <p className='text-sm text-muted-foreground'>{kit.description}</p>
            <ul className='mt-4 flex flex-col gap-1.5'>
                {kit.items.map((item) => {
                    const state =
                        states[item.name] ?? (looksInstalled(names, ...itemKeys(item)) ? 'skipped' : 'waiting');
                    return (
                        <li
                            key={item.name}
                            className='flex items-center gap-3 rounded-lg border border-border px-3 py-2'
                        >
                            <Package className='size-4 text-muted-foreground' aria-hidden />
                            <span className='min-w-0 flex-1'>
                                <span className='block text-sm font-medium'>{item.name}</span>
                                {errors[item.name] && (
                                    <span className='block text-xs text-destructive'>{errors[item.name]}</span>
                                )}
                            </span>
                            <span className='text-xs text-muted-foreground'>
                                {state === 'installing' && <Spinner size='small' />}
                                {state === 'done' && <Check className='size-4 text-success' aria-label='Installed' />}
                                {state === 'failed' && (
                                    <CircleAlert className='size-4 text-destructive' aria-label='Failed' />
                                )}
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

const KIT_ICONS: Record<string, LucideIcon> = {
    survival: Pickaxe,
    creative: Paintbrush,
    lobby: DoorOpen,
    crossplay: Smartphone,
    community: MessagesSquare,
    staff: ShieldCheck,
};

function useKitIcons() {
    const slugs = [
        ...new Set(kits.flatMap((k) => k.items.flatMap((item) => (item.source === 'modrinth' ? [item.slug] : [])))),
    ];
    return (
        useQuery({
            queryKey: ['obsidian-mc', 'kit-icons'],
            queryFn: async () => {
                const response = await fetch(
                    `https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(slugs))}`
                );
                if (!response.ok) return {};
                const projects = (await response.json()) as { slug: string; icon_url: string | null }[];
                return Object.fromEntries(projects.map((p) => [p.slug, p.icon_url]));
            },
            staleTime: Infinity,
        }).data ?? {}
    );
}

function PluginIcon({
    item,
    icons,
    size = 28,
}: {
    item: KitItem;
    icons: Record<string, string | null>;
    size?: number;
}) {
    const url = item.source === 'modrinth' ? icons[item.slug] : null;
    return url ? (
        <img
            src={url}
            alt=''
            loading='lazy'
            className='shrink-0 rounded-md border border-border bg-muted object-cover'
            style={{ width: size, height: size }}
        />
    ) : (
        <span
            className='grid shrink-0 place-items-center rounded-md border border-border bg-muted text-[0.6rem] font-bold'
            style={{ width: size, height: size }}
        >
            {item.name.slice(0, 2)}
        </span>
    );
}

function KitCard({
    kit,
    names,
    icons,
    open,
    disabled,
    onToggle,
    onInstall,
}: {
    kit: Kit;
    names: string[];
    icons: Record<string, string | null>;
    open: boolean;
    disabled: boolean;
    onToggle: () => void;
    onInstall: () => void;
}) {
    const Glyph = KIT_ICONS[kit.id] ?? Package;
    const present = kit.items.map((item) => looksInstalled(names, ...itemKeys(item)));
    const here = present.filter(Boolean).length;
    const missing = kit.items.length - here;

    return (
        <li
            className={cn(
                'obs-surface flex flex-col overflow-hidden transition-[border-color] duration-200',
                open && 'border-foreground/20'
            )}
        >
            <button
                type='button'
                aria-expanded={open}
                onClick={onToggle}
                className='flex w-full flex-col gap-4 p-5 text-left'
            >
                <span className='flex items-start gap-3'>
                    <span className='grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-muted'>
                        <Glyph className='size-[18px]' aria-hidden />
                    </span>
                    <span className='min-w-0 flex-1'>
                        <span className='block text-base font-bold tracking-tight'>{kit.name}</span>
                        <span className='block text-xs text-muted-foreground'>{kit.eyebrow}</span>
                    </span>
                    <ChevronDown
                        className={cn(
                            'mt-1 size-4 text-muted-foreground transition-transform duration-200',
                            open && 'rotate-180'
                        )}
                        aria-hidden
                    />
                </span>
                <span className='text-sm text-muted-foreground'>{kit.description}</span>
                <span className='flex items-center gap-3'>
                    <span className='flex -space-x-1.5'>
                        {kit.items.slice(0, 5).map((item) => (
                            <PluginIcon key={item.name} item={item} icons={icons} size={24} />
                        ))}
                        {kit.items.length > 5 && (
                            <span className='grid size-6 place-items-center rounded-md border border-border bg-muted text-[0.6rem] font-semibold'>
                                +{kit.items.length - 5}
                            </span>
                        )}
                    </span>
                    <span className='ml-auto text-xs text-muted-foreground tabular-nums'>
                        {here}/{kit.items.length} installed
                    </span>
                </span>
                <span className='block h-1 overflow-hidden rounded-full bg-border'>
                    <span
                        className='block h-full rounded-full bg-success transition-[width] duration-500'
                        style={{ width: `${(here / kit.items.length) * 100}%` }}
                    />
                </span>
            </button>
            <Collapse open={open}>
                <div className='border-t border-border px-5 pt-3 pb-5'>
                    <ul className='flex flex-col'>
                        {kit.items.map((item, index) => (
                            <li key={item.name} className='flex items-center gap-3 py-1.5'>
                                <PluginIcon item={item} icons={icons} />
                                <span className='min-w-0 flex-1 truncate text-sm font-medium'>{item.name}</span>
                                {present[index] ? (
                                    <Check className='size-4 text-success' aria-label='Installed' />
                                ) : (
                                    <span className='text-xs text-muted-foreground'>Missing</span>
                                )}
                            </li>
                        ))}
                    </ul>
                    <Button
                        size='large'
                        className='mt-4 w-full'
                        disabled={disabled || missing === 0}
                        onClick={onInstall}
                    >
                        {missing === 0 ? 'Everything is installed' : `Install ${missing} missing`}
                    </Button>
                </div>
            </Collapse>
        </li>
    );
}

export default function KitsScreen() {
    const { installed, gameVersion } = useToolkit();
    const folder = useDirectory('/plugins');
    const names = (folder.data ?? []).map((e) => e.name);
    const icons = useKitIcons();
    const [expanded, setExpanded] = useState<string | null>(kits[0]?.id ?? null);
    const [installing, setInstalling] = useState<Kit | null>(null);
    const modded = installed ? isModded(installed.software) : false;

    return (
        <Page
            title='Kits'
            description={`Plugin bundles for common setups, matched to ${installed && installed.software !== 'unknown' ? softwareLabel[installed.software] : 'this server'}${gameVersion ? ` ${gameVersion}` : ''}. Plugins you already have are skipped.`}
        >
            {modded && (
                <Alert type='warning'>
                    Kits install plugins, and this server loads mods. Switch to Paper or Purpur on the Versions page
                    first.
                </Alert>
            )}
            <ul className='gap-4 md:columns-2 xl:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid'>
                {kits.map((kit) => (
                    <KitCard
                        key={kit.id}
                        kit={kit}
                        names={names}
                        icons={icons}
                        open={expanded === kit.id}
                        disabled={modded}
                        onToggle={() => setExpanded(expanded === kit.id ? null : kit.id)}
                        onInstall={() => setInstalling(kit)}
                    />
                ))}
            </ul>
            {installing && <InstallDialog kit={installing} onClose={() => setInstalling(null)} />}
        </Page>
    );
}
