import { useState, type CSSProperties } from 'react';
import { Minus, Plus, WrapText } from 'lucide-react';
import { View, type ViewProps } from '@pterodactyl/sdk/theme';
import { cn } from '@pterodactyl/sdk/theme';

const preferenceKey = 'obsidian:file-editor';

function readPreferences() {
    try {
        const value = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}') as { size?: number; wrap?: boolean };
        return {
            size: [12, 13, 14, 15, 16, 18, 20].includes(value.size ?? 14) ? (value.size ?? 14) : 14,
            wrap: value.wrap ?? true,
        };
    } catch {
        return { size: 14, wrap: true };
    }
}

export default function FileEditor({ className, model }: ViewProps<'server.files.editor'>) {
    const [preferences, setPreferences] = useState(readPreferences);
    const update = (next: typeof preferences) => {
        setPreferences(next);
        try {
            localStorage.setItem(preferenceKey, JSON.stringify(next));
        } catch {
            return;
        }
    };
    const sizes = [12, 13, 14, 15, 16, 18, 20];
    const sizeIndex = sizes.indexOf(preferences.size);

    return (
        <section
            className={cn(
                'obs-file-editor min-w-0 overflow-hidden rounded-2xl border border-border bg-card',
                className
            )}
            data-wrap={preferences.wrap}
            style={{ '--obs-editor-font': `${preferences.size}px` } as CSSProperties}
        >
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5 sm:px-4'>
                <div className='min-w-0'>
                    <p className='truncate text-sm font-semibold'>{model.name || 'New file'}</p>
                    <p className='truncate text-xs text-muted-foreground'>{model.path}</p>
                </div>
                <div className='flex items-center gap-1.5'>
                    <button
                        type='button'
                        aria-label='Decrease editor text size'
                        disabled={sizeIndex <= 0}
                        onClick={() => update({ ...preferences, size: sizes[Math.max(0, sizeIndex - 1)] })}
                        className='grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-40'
                    >
                        <Minus className='size-4' />
                    </button>
                    <span className='min-w-10 text-center text-xs tabular-nums text-muted-foreground'>
                        {preferences.size}px
                    </span>
                    <button
                        type='button'
                        aria-label='Increase editor text size'
                        disabled={sizeIndex >= sizes.length - 1}
                        onClick={() =>
                            update({ ...preferences, size: sizes[Math.min(sizes.length - 1, sizeIndex + 1)] })
                        }
                        className='grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-40'
                    >
                        <Plus className='size-4' />
                    </button>
                    <button
                        type='button'
                        aria-pressed={preferences.wrap}
                        onClick={() => update({ ...preferences, wrap: !preferences.wrap })}
                        className='ml-1 flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted aria-pressed:bg-muted aria-pressed:text-foreground'
                    >
                        <WrapText className='size-4' />
                        <span className='hidden sm:inline'>Wrap lines</span>
                    </button>
                </div>
            </div>
            <div className='obs-file-editor-canvas min-w-0 overflow-hidden p-2 sm:p-3'>
                <model.Editor />
            </div>
            <div className='sticky bottom-0 flex flex-col gap-2 border-t border-border bg-card/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4'>
                <div className='min-w-0 flex-1'>
                    <View name='server.files.editor.notice' model={model} />
                    <View name='server.files.editor.language' model={model} />
                </div>
                <View name='server.files.editor.actions' model={model} />
            </div>
        </section>
    );
}
