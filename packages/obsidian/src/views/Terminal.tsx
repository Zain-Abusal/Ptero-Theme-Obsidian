import {
    useCallback,
    useEffect,
    useId,
    useRef,
    useState,
    type Dispatch,
    type KeyboardEvent,
    type SetStateAction,
} from 'react';
import { ArrowRight, ChevronsDown, TerminalSquare } from 'lucide-react';
import { Button, SpinnerOverlay, cn, useCurrentServer } from '@pterodactyl/sdk';
import type { ServerConsoleCommand, ViewProps } from '@pterodactyl/sdk/theme';
import { isMinecraft } from '../tools/lib/minecraft';
import ConsoleTools from './console/ConsoleTools';
import { getSuggestions, type Suggestion } from './console/autocomplete';

const MAX_VISIBLE = 6;

interface AutocompleteState {
    suggestions: readonly Suggestion[];
    selectedIndex: number;
    setSelectedIndex: Dispatch<SetStateAction<number>>;
    accept: (suggestion: Suggestion) => void;
    dismiss: () => void;
    onHistoryStep: () => void;
}

function onCommandKey(
    command: ServerConsoleCommand,
    event: KeyboardEvent<HTMLInputElement>,
    autocomplete: AutocompleteState
) {
    const { suggestions, selectedIndex, setSelectedIndex, accept, dismiss, onHistoryStep } = autocomplete;

    if (event.key === 'Tab') {
        if (suggestions.length > 0 && !event.shiftKey) {
            event.preventDefault();
            const chosen = suggestions[selectedIndex >= 0 ? selectedIndex : 0];
            if (chosen) accept(chosen);
        }
        return;
    }

    if (event.key === 'Escape') {
        if (suggestions.length > 0) {
            event.preventDefault();
            dismiss();
        }
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (suggestions.length > 0) {
            setSelectedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else {
            onHistoryStep();
            command.previous();
        }
        return;
    }

    if (event.key === 'ArrowDown') {
        if (suggestions.length > 0) {
            event.preventDefault();
            setSelectedIndex((i) => (i + 1) % suggestions.length);
        } else {
            onHistoryStep();
            command.next();
        }
        return;
    }

    if (event.key === 'Enter') {
        if (suggestions.length > 0 && selectedIndex >= 0) {
            const chosen = suggestions[selectedIndex];
            if (chosen) {
                event.preventDefault();
                accept(chosen);
                return;
            }
        }
        dismiss();
        command.submit();
    }
}

export default function Terminal({ model, className }: ViewProps<'server.terminal'>) {
    const { command } = model;

    const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const suppress = useRef(false);
    const commandBar = useRef<HTMLDivElement>(null);
    const listboxId = useId();

    const server = useCurrentServer();
    const minecraft = isMinecraft(server);

    const dismiss = useCallback(() => {
        setSuggestions([]);
        setSelectedIndex(-1);
    }, []);

    const accept = useCallback(
        (suggestion: Suggestion) => {
            if (suggestion.text !== command.value) suppress.current = true;
            command.setValue(suggestion.text);
            dismiss();
        },
        [command, dismiss]
    );

    const onHistoryStep = useCallback(() => {
        if (command.history.length > 0) suppress.current = true;
    }, [command.history.length]);

    useEffect(() => {
        if (!minecraft || command.disabled) {
            dismiss();
            return;
        }
        if (suppress.current) {
            suppress.current = false;
            return;
        }
        setSuggestions(getSuggestions(command.value, command.history).slice(0, MAX_VISIBLE));
        setSelectedIndex(-1);
    }, [command.value, command.history, command.disabled, minecraft, dismiss]);

    useEffect(() => {
        if (suggestions.length === 0) return;
        const close = (event: MouseEvent) => {
            if (commandBar.current && !commandBar.current.contains(event.target as Node)) dismiss();
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [suggestions.length, dismiss]);

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
                <div
                    ref={commandBar}
                    className='relative flex items-center gap-2 border-t border-border/70 py-2 pr-2 pl-4'
                >
                    {suggestions.length > 0 && (
                        <div className='obs-pop-up absolute right-0 bottom-full left-0 z-20 mb-1 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg'>
                            <div
                                id={listboxId}
                                role='listbox'
                                aria-label='Command suggestions'
                                className='max-h-60 overflow-y-auto'
                            >
                                {suggestions.map((item, index) => (
                                    <button
                                        key={`${item.source}-${item.text}`}
                                        id={`${listboxId}-${index}`}
                                        type='button'
                                        role='option'
                                        aria-selected={index === selectedIndex}
                                        tabIndex={-1}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        onClick={() => accept(item)}
                                        className={cn(
                                            'flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 text-left font-mono text-sm transition-colors hover:bg-muted',
                                            index === selectedIndex && 'bg-muted shadow-[inset_2px_0_0_var(--primary)]'
                                        )}
                                    >
                                        <span className='min-w-0 flex-1 truncate'>{item.text}</span>
                                        <span
                                            className={cn(
                                                'shrink-0 rounded-full border px-2 py-0.5 font-sans text-[0.65rem] font-medium',
                                                item.source === 'history'
                                                    ? 'border-success/35 bg-success/12 text-success'
                                                    : 'border-border text-muted-foreground'
                                            )}
                                        >
                                            {item.source}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <span className='font-mono text-sm font-bold text-success' aria-hidden>
                        $
                    </span>
                    <input
                        type='text'
                        placeholder='Type a command…'
                        aria-label='Console command'
                        aria-autocomplete='list'
                        aria-controls={suggestions.length > 0 ? listboxId : undefined}
                        aria-activedescendant={
                            suggestions.length > 0 && selectedIndex >= 0 ? `${listboxId}-${selectedIndex}` : undefined
                        }
                        disabled={command.disabled}
                        value={command.value}
                        onChange={(event) => {
                            suppress.current = false;
                            command.setValue(event.currentTarget.value);
                        }}
                        onKeyDown={(event) =>
                            onCommandKey(command, event, {
                                suggestions,
                                selectedIndex,
                                setSelectedIndex,
                                accept,
                                dismiss,
                                onHistoryStep,
                            })
                        }
                        onBlur={(event) => {
                            if (!commandBar.current?.contains(event.relatedTarget as Node | null)) dismiss();
                        }}
                        autoCorrect='off'
                        autoCapitalize='none'
                        spellCheck={false}
                        className='h-9 min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm text-terminal-foreground outline-none placeholder:text-muted-foreground/70 focus:ring-0'
                    />
                    <button
                        type='button'
                        aria-label='Send command'
                        disabled={command.disabled || command.value.trim() === ''}
                        onClick={() => {
                            dismiss();
                            command.submit();
                        }}
                        className='grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition disabled:bg-muted disabled:text-muted-foreground'
                    >
                        <ArrowRight className='size-4' aria-hidden />
                    </button>
                </div>
            )}
        </div>
    );
}
