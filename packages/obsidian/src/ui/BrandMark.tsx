import { cn } from '@pterodactyl/sdk/theme';

/** The default mark beside the brand name when no logo is uploaded: an isometric gem. */
export default function BrandMark({ className }: { className?: string }) {
    return (
        <svg viewBox='0 0 32 32' className={cn('size-7 shrink-0', className)} aria-hidden>
            <path d='M16 2 29 9.5v13L16 30 3 22.5v-13Z' fill='var(--foreground)' opacity='0.95' />
            <path d='M16 16 29 9.5v13L16 30Z' fill='var(--foreground)' opacity='0.55' />
            <path d='M16 16 3 9.5 16 2l13 7.5Z' fill='var(--background)' opacity='0.25' />
        </svg>
    );
}
