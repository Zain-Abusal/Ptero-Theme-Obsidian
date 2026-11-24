import { useState, type ReactNode } from 'react';
import { cn } from '@pterodactyl/sdk/theme';

export default function Collapse({
    open,
    children,
    className,
}: {
    open: boolean;
    children: ReactNode;
    className?: string;
}) {
    const [mounted, setMounted] = useState(open);
    if (open && !mounted) setMounted(true);

    return (
        <div data-open={open || undefined} className={cn('obs-collapse', className)} inert={!open}>
            <div className='min-h-0 overflow-hidden'>{mounted && children}</div>
        </div>
    );
}
