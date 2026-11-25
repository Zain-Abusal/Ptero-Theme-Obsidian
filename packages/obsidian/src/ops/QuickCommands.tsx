import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { SdkServer as Server } from '@pterodactyl/sdk';
import type { ServerConsoleCommand } from '@pterodactyl/sdk/theme';
import { isMinecraft } from '../tools/lib/minecraft';
import Collapse from '../ui/Collapse';
import { useQuickCommands, type QuickCommand } from './commands';

export default function QuickCommands({ server, command }: { server: Server; command: ServerConsoleCommand }) {
    const { commands, save } = useQuickCommands(server.attributes.identifier);
    const [showAll, setShowAll] = useState(false);
    const [editing, setEditing] = useState(false);
    const [label, setLabel] = useState('');
    const [value, setValue] = useState('');
    const [confirm, setConfirm] = useState(false);
    const [pending, setPending] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (pending === null || command.value !== pending) return;
        command.submit();
        setPending(null);
    }, [command, pending]);

    if (!isMinecraft(server)) return null;

    const update = async (next: readonly QuickCommand[]) => {
        setSaving(true);
        setError('');
        try {
            await save(next);
            return true;
        } catch {
            setError('Could not save commands. Check your file permission and try again.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const run = (item: QuickCommand) => {
        if (command.disabled || saving) return;
        if (item.confirm && !window.confirm(`Send "${item.command}" to the server?`)) return;
        setPending(item.command);
        command.setValue(item.command);
    };

    const add = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const next = [...commands, { label, command: value, ...(confirm ? { confirm: true } : {}) }];
        if (!(await update(next))) return;
        setLabel('');
        setValue('');
        setConfirm(false);
    };

    const visible = commands.slice(0, 6);

    return (
        <div className='border-t border-border/70 px-3 py-2'>
            <div className='flex flex-wrap items-center gap-2'>
                {visible.map((item, index) => (
                    <button
                        key={`${item.label}-${index}`}
                        type='button'
                        disabled={command.disabled || saving}
                        onClick={() => run(item)}
                        className='rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'
                        title={item.confirm ? 'Confirmation required' : `Send ${item.command}`}
                    >
                        {item.label}
                    </button>
                ))}
                {commands.length > 6 && (
                    <button
                        type='button'
                        aria-expanded={showAll}
                        onClick={() => setShowAll((open) => !open)}
                        className='inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground'
                    >
                        {showAll ? 'Less' : 'More'}
                        <ChevronDown
                            className={`size-3 transition-transform ${showAll ? 'rotate-180' : ''}`}
                            aria-hidden
                        />
                    </button>
                )}
                <button
                    type='button'
                    aria-expanded={editing}
                    onClick={() => setEditing((open) => !open)}
                    className='inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground'
                >
                    <Plus className='size-3' aria-hidden />
                    Edit
                </button>
            </div>
            {commands.length > 6 && (
                <Collapse open={showAll} className='mt-2'>
                    <div className='flex flex-wrap gap-2'>
                        {commands.slice(6).map((item, index) => (
                            <button
                                key={`${item.label}-${index + 6}`}
                                type='button'
                                disabled={command.disabled || saving}
                                onClick={() => run(item)}
                                className='rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'
                                title={item.confirm ? 'Confirmation required' : `Send ${item.command}`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </Collapse>
            )}
            <Collapse open={editing} className='mt-3'>
                <div className='grid gap-3 rounded-lg border border-border bg-card p-3'>
                    <ul className='grid gap-2 sm:grid-cols-2'>
                        {commands.map((item, index) => (
                            <li key={`${item.label}-${index}`} className='flex min-w-0 items-center gap-2 text-xs'>
                                <span className='min-w-0 flex-1 truncate text-foreground'>{item.label}</span>
                                <code className='max-w-[45%] truncate text-muted-foreground'>{item.command}</code>
                                <button
                                    type='button'
                                    aria-label={`Remove ${item.label}`}
                                    disabled={saving}
                                    onClick={() => void update(commands.filter((_, i) => i !== index))}
                                    className='grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50'
                                >
                                    <Trash2 className='size-3.5' aria-hidden />
                                </button>
                            </li>
                        ))}
                    </ul>
                    <form onSubmit={add} className='grid gap-2 sm:grid-cols-[1fr_1fr_auto]'>
                        <input
                            value={label}
                            onChange={(event) => setLabel(event.currentTarget.value)}
                            maxLength={32}
                            placeholder='Button label'
                            aria-label='Quick command label'
                            required
                            className='h-9 min-w-0 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary'
                        />
                        <input
                            value={value}
                            onChange={(event) => setValue(event.currentTarget.value)}
                            maxLength={255}
                            placeholder='Server command'
                            aria-label='Quick command'
                            required
                            className='h-9 min-w-0 rounded-md border border-border bg-background px-3 font-mono text-sm outline-none focus:border-primary'
                        />
                        <button
                            type='submit'
                            disabled={saving || commands.length >= 30}
                            className='h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50'
                        >
                            Add
                        </button>
                        <label className='flex items-center gap-2 text-xs text-muted-foreground sm:col-span-3'>
                            <input
                                type='checkbox'
                                checked={confirm}
                                onChange={(event) => setConfirm(event.currentTarget.checked)}
                            />
                            Ask before sending this command
                        </label>
                    </form>
                    {error && (
                        <p role='alert' className='text-xs text-destructive'>
                            {error}
                        </p>
                    )}
                    <p className='text-xs text-muted-foreground'>
                        Commands are saved for this server in its Obsidian settings file.
                    </p>
                </div>
            </Collapse>
        </div>
    );
}
