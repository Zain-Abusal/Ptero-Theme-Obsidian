import type { ReactNode } from 'react';
import { ServerContentBlock, cn, httpErrorToHuman } from '@pterodactyl/sdk';

/** A toolkit page: a title block, optional actions, then the content. */
export default function Page({
    title,
    description,
    actions,
    children,
    className,
}: {
    title: string;
    description: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <ServerContentBlock title={title}>
            <div className={cn('flex flex-col gap-6', className)}>
                <header className='flex flex-wrap items-end gap-4'>
                    <div className='min-w-0 flex-1'>
                        <h1 className='font-header text-3xl font-bold tracking-tight'>{title}</h1>
                        <p className='mt-1 text-sm text-muted-foreground'>{description}</p>
                    </div>
                    {actions}
                </header>
                {children}
            </div>
        </ServerContentBlock>
    );
}

/** A bordered panel; `title` adds a quiet header. */
export function Panel({
    title,
    aside,
    children,
    className,
}: {
    title?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('rounded-xl border border-border bg-card', className)}>
            {title && (
                <div className='flex items-center gap-3 border-b border-border px-5 py-3'>
                    <h2 className='flex-1 text-sm font-semibold'>{title}</h2>
                    {aside}
                </div>
            )}
            <div className='p-5'>{children}</div>
        </section>
    );
}

/** Small caps label. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <p className={cn('text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase', className)}>
            {children}
        </p>
    );
}

/** A pill switch between a few choices. */
export function Segmented<T extends string>({
    value,
    options,
    onChange,
    label,
    className,
}: {
    value: T;
    options: readonly { value: T; label: ReactNode }[];
    onChange: (value: T) => void;
    label: string;
    className?: string;
}) {
    return (
        <div
            role='tablist'
            aria-label={label}
            className={cn('inline-flex flex-wrap rounded-full border border-border bg-card p-1', className)}
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    type='button'
                    role='tab'
                    aria-selected={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                        value === option.value
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

/** A step number in a circle, for numbered sections. */
export function Step({ n, children }: { n: number; children: ReactNode }) {
    return (
        <div className='mb-3 flex items-center gap-2.5'>
            <span className='grid size-5 place-items-center rounded-full bg-foreground text-[0.65rem] font-bold text-background'>
                {n}
            </span>
            <Eyebrow>{children}</Eyebrow>
        </div>
    );
}

/** Wraps an action that may fail and reports both outcomes. */
export async function attempt<T>(work: () => Promise<T>, done: string, toast: { success: (m: string) => void; error: (m: string) => void }) {
    try {
        const result = await work();
        toast.success(done);
        return result;
    } catch (error) {
        toast.error(httpErrorToHuman(error));
        return undefined;
    }
}
