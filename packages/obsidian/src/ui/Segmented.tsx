import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@pterodactyl/sdk/theme';

export interface SegmentedOption<T extends string> {
    readonly value: T;
    readonly label: ReactNode;
}

export default function Segmented<T extends string>({
    value,
    options,
    onChange,
    label,
    size = 'md',
    className,
}: {
    value: T;
    options: readonly SegmentedOption<T>[];
    onChange: (value: T) => void;
    label: string;
    size?: 'sm' | 'md';
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const root = ref.current;
        if (!root) return;
        const place = () => {
            const active = root.querySelector<HTMLElement>('[aria-selected="true"]');
            if (!active || active.offsetWidth === 0) {
                delete root.dataset.measured;
                return;
            }
            root.style.setProperty('--seg-x', `${active.offsetLeft}px`);
            root.style.setProperty('--seg-w', `${active.offsetWidth}px`);
            root.dataset.measured = '';
        };
        place();
        const observer = new ResizeObserver(place);
        observer.observe(root);
        void document.fonts?.ready.then(place);
        return () => observer.disconnect();
    }, [value, options.length]);

    return (
        <div
            ref={ref}
            role='tablist'
            aria-label={label}
            className={cn(
                'obs-segmented relative inline-flex max-w-full rounded-full border border-border bg-card p-1',
                className
            )}
        >
            <span aria-hidden className='obs-segmented-thumb' />
            {options.map((option) => (
                <button
                    key={option.value}
                    type='button'
                    role='tab'
                    aria-selected={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'relative z-1 inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors duration-200',
                        size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-xs',
                        value === option.value
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
