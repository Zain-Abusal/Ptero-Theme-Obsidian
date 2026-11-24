import { useState, type KeyboardEvent } from 'react';
import { ArrowRight, ChevronsDown, TerminalSquare } from 'lucide-react';
import { Button, SpinnerOverlay, cn, useCurrentServer } from '@pterodactyl/sdk';
import type { ServerConsoleCommand, ViewProps } from '@pterodactyl/sdk/theme';
import ConsoleTools from './console/ConsoleTools';

function onCommandKey(command: ServerConsoleCommand, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp') {
        event.preventDefault();
        command.previous();
    } else if (event.key === 'ArrowDown') {
        command.next();
    } else if (event.key === 'Enter') {
        command.submit();
    }
}

export default function Terminal({ model, className }: ViewProps<'server.terminal'>) {
    const { command } = model;

    const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);

    const server = useCurrentServer();

    return (
        <div
            className={cn(
                'relative flex w-full flex-col overflow-hidden rounded-xl border border-border bg-terminal',
                className
            )}
        >
            <SpinnerOverlay visible={model.loading} size='large' />
            <div className='flex min-h-12 items-center gap-2 border-b border-border/70 py-1.5 pr-2 pl-4'>
                <TerminalSquare className='size-4 text-muted-foreground' aria-hidden />
                <span className='obs-eyebrow text-[0.62rem]'>Console</span>
                {server && <ConsoleTools server={server} command={command} overlay={overlay} />}
            </div>
            {model.failed && (
                <div
                    role='alert'
                    className='absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-terminal p-4 text-center text-sm'
                >
                    <p>The console could not be loaded.</p>
                    <Button size='small' color='grey' onClick={model.retry}>
                        Try again
                    </Button>
                </div>
            )}
            <div
                ref={setOverlay}
                className='relative min-h-64 flex-1 overflow-hidden px-3 pt-2 font-mono text-[0.82rem] caret-transparent'
            >
                <model.Terminal />
                {model.scrolledUp && (
                    <button
                        type='button'
                        onClick={model.scrollToBottom}
                        aria-label='Scroll to bottom'
                        className='absolute right-5 bottom-3 z-10 grid size-9 place-items-center rounded-full border border-border bg-popover text-foreground shadow-lg hover:bg-muted'
                    >
                        <ChevronsDown className='size-4' aria-hidden />
                    </button>
                )}
            </div>
            {command.allowed && (
                <div className='flex items-center gap-2 border-t border-border/70 py-2 pr-2 pl-4'>
                    <span className='font-mono text-sm font-bold text-success' aria-hidden>
                        $
                    </span>
                    <input
                        type='text'
                        placeholder='Type a command…'
                        aria-label='Console command'
                        disabled={command.disabled}
                        value={command.value}
                        onChange={(event) => command.setValue(event.currentTarget.value)}
                        onKeyDown={(event) => onCommandKey(command, event)}
                        autoCorrect='off'
                        autoCapitalize='none'
                        spellCheck={false}
                        className='h-9 min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm text-terminal-foreground outline-none placeholder:text-muted-foreground/70 focus:ring-0'
                    />
                    <button
                        type='button'
                        aria-label='Send command'
                        disabled={command.disabled || command.value.trim() === ''}
                        onClick={command.submit}
                        className='grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition disabled:bg-muted disabled:text-muted-foreground'
                    >
                        <ArrowRight className='size-4' aria-hidden />
                    </button>
                </div>
            )}
        </div>
    );
}
