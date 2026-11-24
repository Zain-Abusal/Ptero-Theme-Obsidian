import { cn } from '@pterodactyl/sdk/theme';

/**
 * A ring gauge: a track and an arc for `value` (0 to 1, or null for unlimited). The arc turns
 * warning and danger at the panel's alarm thresholds.
 */
export default function Gauge({
    value,
    label,
    text,
    tone,
    size = 34,
    className,
}: {
    value: number | null;
    label: string;
    text: string;
    tone?: 'warning' | 'danger' | null;
    size?: number;
    className?: string;
}) {
    const stroke = 3.5;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const shown = value === null ? 0.08 : Math.max(0.02, value);
    const colour = tone === 'danger' ? 'var(--destructive)' : tone === 'warning' ? 'var(--warning)' : 'var(--success)';

    return (
        <div className={cn('obs-gauge flex items-center gap-2.5', className)}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className='-rotate-90 shrink-0' aria-hidden>
                <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='var(--border)' strokeWidth={stroke} />
                <circle
                    data-arc
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill='none'
                    stroke={colour}
                    strokeWidth={stroke}
                    strokeLinecap='round'
                    strokeDasharray={c}
                    strokeDashoffset={c * (1 - shown)}
                    opacity={value === null ? 0.5 : 1}
                />
            </svg>
            <div className='min-w-0 leading-tight'>
                <p className='obs-eyebrow text-[0.625rem]'>{label}</p>
                <p className='obs-num truncate text-xs font-semibold text-foreground'>{text}</p>
            </div>
        </div>
    );
}
