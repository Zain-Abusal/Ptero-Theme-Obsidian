import { cn } from '@pterodactyl/sdk/theme';

const tones = {
    success: 'bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success)_22%,transparent)]',
    warning: 'bg-warning animate-pulse',
    neutral: 'bg-muted-foreground/60',
    danger: 'bg-destructive',
} as const;

export default function StatusDot({ tone, className }: { tone: keyof typeof tones; className?: string }) {
    return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', tones[tone], className)} />;
}
