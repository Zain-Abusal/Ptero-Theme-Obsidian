import type { ReactNode } from 'react';
import { Box } from 'lucide-react';
import { cn } from '@pterodactyl/sdk';
import fabricLogo from '../assets/fabric.png?inline';
import forgeLogo from '../assets/forge.svg';
import paperLogo from '../assets/papermc.svg';
import purpurLogo from '../assets/purpur.svg';
import velocityLogo from '../assets/velocity.svg';
import neoforgeLogo from '../assets/neoforged.png?inline';

const BRAND_LOGOS: Record<string, string> = {
    paper: paperLogo,
    purpur: purpurLogo,
    fabric: fabricLogo,
    velocity: velocityLogo,
    forge: forgeLogo,
    neoforge: neoforgeLogo,
};

const LOGOS: Record<string, ReactNode> = {
    paper: (
        <>
            <path d='M21.5 2.5 2.5 10.6 8.7 13.1Z' fill='currentColor' />
            <path d='M21.5 2.5 11.1 15.5 13.5 21.5Z' fill='currentColor' />
            <path d='M9.7 14.3v5.3l1.7-3.1Z' fill='currentColor' opacity='0.55' />
        </>
    ),
    purpur: (
        <>
            <path d='M12 2.2 19.4 8.7 12 11.5 4.6 8.7Z' fill='currentColor' />
            <path d='M4.6 10.2 11.3 12.8v9Z' fill='currentColor' opacity='0.8' />
            <path d='M19.4 10.2 12.7 12.8v9Z' fill='currentColor' opacity='0.55' />
        </>
    ),
    folia: (
        <>
            <path d='M4 20 7.2 16.8' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
            <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M20 4C13 3.5 5.5 8.5 6.5 17.5 15.5 18.5 20.5 11 20 4ZM7.7 15.5C9.9 12.7 12.3 10.4 15.4 8.6 13.5 11.7 11.2 14.1 8.4 16.3Z'
                fill='currentColor'
            />
        </>
    ),
    vanilla: (
        <>
            <path d='M12 8.5C9.9 6.8 8.8 4.2 12 2c3.2 2.2 2.1 4.8 0 6.5Z' fill='currentColor' />
            <path d='M15.3 10.9c1-2.5 3.1-4.4 6.2-2-1.1 3.7-3.9 3.5-6.2 2Z' fill='currentColor' />
            <path d='M14.1 14.8c2.7.2 5.1 1.6 3.8 5.3-3.9.1-4.5-2.7-3.8-5.3Z' fill='currentColor' />
            <path d='M9.9 14.8c.7 2.6.1 5.4-3.8 5.3-1.3-3.7 1.1-5.1 3.8-5.3Z' fill='currentColor' />
            <path d='M8.7 10.9C6.4 12.4 3.6 12.6 2.5 8.9c3.1-2.4 5.2-.5 6.2 2Z' fill='currentColor' />
            <circle cx='12' cy='12' r='1.7' fill='currentColor' />
        </>
    ),
    fabric: (
        <>
            <path d='M12 2.1 17.7 7.8 14.5 10.9 8.9 5.2Z' fill='currentColor' />
            <path d='M21.9 12 16.2 17.7 13.1 14.5 18.8 8.9Z' fill='currentColor' opacity='0.7' />
            <path d='M12 21.9 6.3 16.2 9.5 13.1 15.1 18.8Z' fill='currentColor' />
            <path d='M2.1 12 7.8 6.3 10.9 9.5 5.2 15.1Z' fill='currentColor' opacity='0.7' />
        </>
    ),
    velocity: (
        <>
            <path d='M7.5 4.5h3.6l2.1 9.1 4.5-9.1h3.8L12.9 19.5Z' fill='currentColor' />
            <path d='M2.5 6h3.8l.6 1.8H3.1Z' fill='currentColor' opacity='0.75' />
            <path d='M4 10.2h3.8l.6 1.8H4.6Z' fill='currentColor' opacity='0.75' />
            <path d='M5.5 14.4h3.8l.6 1.8H6.1Z' fill='currentColor' opacity='0.75' />
        </>
    ),
    spigot: (
        <>
            <path d='M8.5 3.5h7a1 1 0 0 1 0 2H13V8h-2V5.5H8.5a1 1 0 0 1 0-2Z' fill='currentColor' />
            <path
                d='M20.5 7.8a1 1 0 0 1 1 1v3.9a1 1 0 0 1-1 1h-1.3v-1.3h-4.9a2.3 2.3 0 0 0-4.6 0h-.2c-.5 0-.8.3-.8.8v1.3H5.3v-1.7C5.3 10.1 6.8 9 9.5 9h.2a2.3 2.3 0 0 1 4.6 0h4.9V7.8Z'
                fill='currentColor'
            />
            <path d='M7 16.4s2 2.1 2 3.4a2 2 0 1 1-4 0c0-1.3 2-3.4 2-3.4Z' fill='currentColor' />
        </>
    ),
    forge: (
        <path
            d='M2 6.8 7.5 6.4h14v2.8l-4.9.6c-.8 1.6-.8 4 1.2 6.4h1.4v2.4H5.8v-2.4h1.4c2-2.4 2-4.4 1.1-5.4C5.2 10.1 2.7 8.9 2 6.8Z'
            fill='currentColor'
        />
    ),
    neoforge: (
        <>
            <path d='M2 6.2h19.5l-2.1 3.4H6.6Z' fill='currentColor' />
            <path d='M8.8 11.1h7.6l-1.2 3.3 4 4H15l-2.4-2-2.4 2H6l4-4Z' fill='currentColor' opacity='0.78' />
        </>
    ),
};

function SoftwareLogo({ software, className }: { software: string; className?: string }) {
    const cls = cn('size-4 shrink-0', className);
    const brandLogo = BRAND_LOGOS[software.toLowerCase()];
    if (brandLogo)
        return (
            <img
                src={brandLogo}
                alt=''
                aria-hidden
                className={cn(cls, 'object-contain', software.toLowerCase() === 'forge' && 'w-8')}
            />
        );
    const glyph = LOGOS[software.toLowerCase()];
    if (!glyph) return <Box className={cls} aria-hidden />;

    return (
        <svg viewBox='0 0 24 24' fill='none' className={cls} aria-hidden>
            {glyph}
        </svg>
    );
}

export default SoftwareLogo;
