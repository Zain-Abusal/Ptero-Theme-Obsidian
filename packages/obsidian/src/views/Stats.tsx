import { ArrowDown, ArrowUp, Copy } from 'lucide-react';
import { cn, toast } from '@pterodactyl/sdk';
import type { ServerStatMetric, ViewProps } from '@pterodactyl/sdk/theme';
import { bytes, fraction, stateLabel, stateTone, uptime } from '../lib/format';
import StatusDot from '../ui/StatusDot';

function Bar({ metric }: { metric: ServerStatMetric }) {
    const f = fraction(metric);
    if (f === null) return null;

    return (
        <span className='mt-3 block h-1 overflow-hidden rounded-full bg-border'>
            <span
                className={cn(
                    'block h-full rounded-full transition-[width] duration-500',
                    metric.alarm === 'danger' ? 'bg-destructive' : metric.alarm === 'warning' ? 'bg-warning' : 'bg-success'
                )}
                style={{ width: `${Math.max(f * 100, 2)}%` }}
            />
        </span>
    );
}

function Tile({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('obs-surface min-w-0 px-4 py-3.5', className)}>
            <p className='obs-eyebrow text-[0.62rem]'>{label}</p>
            <div className='obs-num mt-1 truncate text-lg font-bold tracking-tight'>{children}</div>
        </div>
    );
}

/** Live values from the server's websocket as a row of tiles. */
export default function Stats({ model, className }: ViewProps<'server.stats'>) {
    const limit = (metric: ServerStatMetric, format: (n: number) => string) =>
        metric.limit > 0 ? <span className='text-xs font-medium text-muted-foreground'> / {format(metric.limit)}</span> : null;

    return (
        <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6', className)}>
            <Tile label='Status'>
                <span className='flex items-center gap-2'>
                    <StatusDot tone={stateTone(model.state)} />
                    {model.state ? stateLabel[model.state] : 'Connecting'}
                </span>
                {model.state === 'running' && (
                    <span className='mt-0.5 block text-xs font-medium text-muted-foreground'>up {uptime(model.uptime)}</span>
                )}
            </Tile>
            <Tile label='CPU'>
                {model.cpu.value.toFixed(1)}%{limit(model.cpu, (n) => `${n}%`)}
                <Bar metric={model.cpu} />
            </Tile>
            <Tile label='Memory'>
                {bytes(model.memory.value)}
                {limit(model.memory, bytes)}
                <Bar metric={model.memory} />
            </Tile>
            <Tile label='Disk'>
                {bytes(model.disk.value)}
                {limit(model.disk, bytes)}
                <Bar metric={model.disk} />
            </Tile>
            <Tile label='Network'>
                <span className='flex flex-wrap items-center gap-x-3 text-sm'>
                    <span className='flex items-center gap-1'>
                        <ArrowDown className='size-3.5 text-success' aria-label='Received' />
                        {bytes(model.network.rx)}
                    </span>
                    <span className='flex items-center gap-1'>
                        <ArrowUp className='size-3.5 text-chart-2' aria-label='Sent' />
                        {bytes(model.network.tx)}
                    </span>
                </span>
            </Tile>
            <Tile label='Address'>
                {model.address ? (
                    <button
                        type='button'
                        onClick={() =>
                            navigator.clipboard?.writeText(model.address!).then(() => toast.success('Address copied.'))
                        }
                        className='flex w-full items-center gap-2 text-left font-mono text-sm font-medium hover:text-success'
                    >
                        <span className='truncate'>{model.address}</span>
                        <Copy className='size-3.5 shrink-0 text-muted-foreground' aria-hidden />
                    </button>
                ) : (
                    <span className='text-sm text-muted-foreground'>None</span>
                )}
            </Tile>
        </div>
    );
}
