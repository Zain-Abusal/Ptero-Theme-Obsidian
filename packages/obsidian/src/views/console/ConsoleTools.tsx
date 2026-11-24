import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, ExternalLink, History, Search, Share2, SquareTerminal, X } from 'lucide-react';
import { Button, DropdownMenu, Dialog, Tooltip, cn, toast, type SdkServer } from '@pterodactyl/sdk';
import type { ServerConsoleCommand } from '@pterodactyl/sdk/theme';
import { shareLog } from '../../tools/lib/doctor';
import LogPanel, { type LevelFilter } from './LogPanel';
import { useConsoleBuffer } from './useConsoleBuffer';

const iconButton =
    'grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40 aria-pressed:bg-muted aria-pressed:text-foreground';

/**
 * The console header's tools. It owns the text buffer, so new lines re-render only this bar (and the log
 * view while it is open), never the engine's terminal canvas. The log view is portalled over the canvas.
 */
export default function ConsoleTools({
    server,
    command,
    overlay,
}: {
    server: SdkServer;
    command: ServerConsoleCommand;
    overlay: HTMLElement | null;
}) {
    const lines = useConsoleBuffer(server.attributes.identifier);
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const [filter, setFilter] = useState<LevelFilter>('all');
    const [sharing, setSharing] = useState(false);
    const [shared, setShared] = useState<string | null>(null);
    const search = useRef<HTMLInputElement>(null);
    const text = () => lines.join('\n');

    const show = (level: LevelFilter) => {
        setFilter(level);
        setOpen(true);
    };

    const copy = () => navigator.clipboard?.writeText(text()).then(() => toast.success(`Copied ${lines.length} lines.`));

    const download = () => {
        const url = URL.createObjectURL(new Blob([text()], { type: 'text/plain' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${server.attributes.name.replace(/[^\w-]+/g, '-')}-console-${new Date().toISOString().slice(0, 16).replace(':', '')}.log`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const share = async () => {
        setSharing(true);
        try {
            setShared(await shareLog(text()));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Sharing failed.');
        }
        setSharing(false);
    };

    const popOut = () =>
        window.open(window.location.href, `obsidian-console-${server.attributes.identifier}`, 'popup,width=980,height=680');

    return (
        <>
            <div className='ml-auto flex min-w-0 items-center gap-1'>
                {open ? (
                    <label className='flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2'>
                        <Search className='size-3.5 text-muted-foreground' aria-hidden />
                        <input
                            ref={search}
                            autoFocus
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder='Search output'
                            aria-label='Search console output'
                            className='h-full w-28 min-w-0 border-0 bg-transparent p-0 text-xs focus:ring-0 sm:w-44'
                        />
                    </label>
                ) : (
                    <Tooltip content='Search'>
                        <button type='button' aria-label='Search console output' onClick={() => show(filter)} className={iconButton}>
                            <Search className='size-4' aria-hidden />
                        </button>
                    </Tooltip>
                )}
                <div role='group' aria-label='Show' className='hidden items-center rounded-lg border border-border p-0.5 sm:flex'>
                    {(
                        [
                            ['all', 'All lines'],
                            ['warn', 'Warnings'],
                            ['error', 'Errors'],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={value}
                            type='button'
                            aria-pressed={open && filter === value}
                            onClick={() => (open && filter === value && value === 'all' ? setOpen(false) : show(value))}
                            className={cn(
                                'rounded-md px-2 py-1 text-[0.7rem] font-semibold transition',
                                open && filter === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {open && (
                    <Tooltip content='Back to the live console'>
                        <button type='button' aria-label='Back to the live console' onClick={() => setOpen(false)} className={iconButton}>
                            <SquareTerminal className='size-4' aria-hidden />
                        </button>
                    </Tooltip>
                )}
                <span className='mx-1 hidden h-5 w-px bg-border sm:block' aria-hidden />
                {command.allowed && (
                    <DropdownMenu
                        triggerClassName={iconButton}
                        triggerContent={
                            <>
                                <History className='size-4' aria-hidden />
                                <span className='sr-only'>Command history</span>
                            </>
                        }
                    >
                        {command.history.length === 0 ? (
                            <DropdownMenu.Item disabled>No commands yet</DropdownMenu.Item>
                        ) : (
                            [...command.history]
                                .reverse()
                                .slice(0, 15)
                                .map((entry, i) => (
                                    <DropdownMenu.Item key={`${entry}-${i}`} onClick={() => command.setValue(entry)}>
                                        <span className='font-mono text-xs'>{entry}</span>
                                    </DropdownMenu.Item>
                                ))
                        )}
                    </DropdownMenu>
                )}
                <Tooltip content='Copy output'>
                    <button type='button' aria-label='Copy console output' onClick={copy} disabled={lines.length === 0} className={iconButton}>
                        <Copy className='size-4' aria-hidden />
                    </button>
                </Tooltip>
                <Tooltip content='Download log'>
                    <button type='button' aria-label='Download console output' onClick={download} disabled={lines.length === 0} className={iconButton}>
                        <Download className='size-4' aria-hidden />
                    </button>
                </Tooltip>
                <Tooltip content='Share to mclo.gs'>
                    <button
                        type='button'
                        aria-label='Share console output'
                        onClick={() => setShared('')}
                        disabled={lines.length === 0}
                        className={cn(iconButton, 'hidden sm:grid')}
                    >
                        <Share2 className='size-4' aria-hidden />
                    </button>
                </Tooltip>
                <Tooltip content='Pop out'>
                    <button type='button' aria-label='Open the console in a new window' onClick={popOut} className={cn(iconButton, 'hidden sm:grid')}>
                        <ExternalLink className='size-4' aria-hidden />
                    </button>
                </Tooltip>
            </div>
            {open && overlay && createPortal(<LogPanel lines={lines} term={term} filter={filter} />, overlay)}
            <Dialog open={shared !== null} onClose={() => setShared(null)} title='Share console output'>
                {shared ? (
                    <a
                        href={shared}
                        target='_blank'
                        rel='noreferrer'
                        className='flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 font-mono text-sm text-foreground no-underline hover:bg-muted'
                    >
                        <span className='min-w-0 flex-1 truncate'>{shared}</span>
                        <ExternalLink className='size-4 shrink-0' aria-hidden />
                    </a>
                ) : (
                    <p className='text-sm text-muted-foreground'>
                        The last {lines.length} lines are uploaded to mclo.gs, a public log host. They leave the panel and may include player names and
                        IP addresses.
                    </p>
                )}
                <Dialog.Footer>
                    <Button.Text onClick={() => setShared(null)}>
                        <X className='size-4' aria-hidden /> Close
                    </Button.Text>
                    {!shared && (
                        <Button onClick={share} isLoading={sharing} disabled={sharing}>
                            <Share2 className='size-4' aria-hidden /> Upload
                        </Button>
                    )}
                </Dialog.Footer>
            </Dialog>
        </>
    );
}
