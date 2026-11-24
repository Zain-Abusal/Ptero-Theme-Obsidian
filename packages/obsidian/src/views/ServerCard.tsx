import { lazy, Suspense, useState } from 'react';
import { ArrowRight, Paintbrush, Pin, Play, Square } from 'lucide-react';
import { Badge, PanelLink, Spinner, Tooltip, cn, type SdkServer } from '@pterodactyl/sdk';
import { can } from '../lib/servers';
import { Slot, type ViewProps } from '@pterodactyl/sdk/theme';
import { bytes, fraction, stateLabel, stateTone } from '../lib/format';
import { usePins } from '../lib/storage';
import ServerIcon from '../lib/serverIcon';
import { defaultTint, useServerMeta } from '../lib/serverMeta';
import { usePlayerCount } from '../lib/players';
import Gauge from '../ui/Gauge';

const CustomizeServer = lazy(() => import('./CustomizeServer'));

const iconButton =
    'relative z-10 grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40';

export default function ServerCard({ model, server, className }: ViewProps<'dashboard.serverCard'>) {
    const { isPinned, toggle } = usePins();
    const { state, permissions, actions } = model;
    const pinned = isPinned(model.uuid);
    const ready = state.kind === 'ready' ? state : null;
    const running = ready?.power === 'running' || ready?.power === 'starting';
    const meta = useServerMeta(model.identifier);
    const tint = meta.color ?? defaultTint(model.uuid);
    const players = usePlayerCount(model.address, ready?.power === 'running');
    const [customizing, setCustomizing] = useState(false);

    return (
        <div
            style={{ '--obs-server-tint': tint } as React.CSSProperties}
            className={cn(
                'obs-surface obs-hover group relative flex flex-wrap items-center gap-x-6 gap-y-3 overflow-hidden px-4 py-3.5',
                'before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-full before:bg-(--obs-server-tint) before:opacity-0 before:transition-opacity hover:before:opacity-100',
                meta.color && 'before:opacity-100',
                className
            )}
        >
            <div className='flex min-w-0 flex-1 basis-64 items-center gap-3.5'>
                <ServerIcon identifier={model.identifier} uuid={model.uuid} size={46} />
                <div className='min-w-0'>
                    <div className='flex min-w-0 items-center gap-2'>
                        <PanelLink
                            destination={{ to: '/server/$id', params: { id: model.identifier } }}
                            className='truncate text-[0.95rem] font-bold tracking-tight text-foreground no-underline after:absolute after:inset-0 after:rounded-[inherit]'
                        >
                            {model.name}
                        </PanelLink>
                        <Slot name='dashboard.serverRow.name.after' data={server} />
                    </div>
                    <div className='mt-1 flex min-w-0 items-center gap-2'>
                        {ready && (
                            <Badge
                                size='sm'
                                tone={stateTone(ready.power)}
                                variant={ready.power === 'running' ? 'solid' : 'soft'}
                            >
                                {stateLabel[ready.power]}
                            </Badge>
                        )}
                        {state.kind === 'unavailable' && (
                            <Badge size='sm' tone='warning' variant='soft'>
                                {state.reason.replace('-', ' ')}
                            </Badge>
                        )}
                        {state.kind === 'loading' && <Spinner size='small' />}
                        {(meta.note || model.description) && (
                            <span className='truncate text-xs text-muted-foreground'>
                                {meta.note || model.description}
                            </span>
                        )}
                    </div>
                </div>
            </div>
            {model.address && (
                <span className='hidden w-40 truncate text-right font-mono text-xs text-muted-foreground xl:block'>
                    {model.address}
                </span>
            )}
            {ready && (
                <div className='flex items-center gap-5'>
                    <Gauge
                        label='CPU'
                        value={ready.cpu.limit > 0 ? fraction(ready.cpu) : Math.min(ready.cpu.value / 100, 1)}
                        text={`${ready.cpu.value.toFixed(0)}%`}
                        tone={ready.cpu.alarm}
                    />
                    <Gauge
                        label='Memory'
                        value={fraction(ready.memory)}
                        text={bytes(ready.memory.value)}
                        tone={ready.memory.alarm}
                    />
                    {players && (
                        <Gauge
                            label='Players'
                            value={players.max > 0 ? players.online / players.max : null}
                            text={`${players.online}/${players.max}`}
                        />
                    )}
                    <Gauge
                        label='Disk'
                        value={fraction(ready.disk)}
                        text={bytes(ready.disk.value)}
                        tone={ready.disk.alarm}
                        className='hidden sm:flex'
                    />
                    <Slot name='dashboard.serverRow.metrics.after' data={server} />
                </div>
            )}
            <div className='ml-auto flex items-center gap-1.5'>
                <CustomizeButton server={server} name={model.name} onClick={() => setCustomizing(true)} />
                <Tooltip content={pinned ? 'Unpin' : 'Pin to the top'}>
                    <button
                        type='button'
                        aria-label={pinned ? `Unpin ${model.name}` : `Pin ${model.name}`}
                        aria-pressed={pinned}
                        onClick={() => toggle(model.uuid)}
                        className={cn(iconButton, pinned && 'text-foreground')}
                    >
                        <Pin className={cn('size-3.5', pinned && 'fill-current')} aria-hidden />
                    </button>
                </Tooltip>
                {!ready && <span className='size-9' aria-hidden />}
                {ready &&
                    (running
                        ? permissions.stop && (
                              <Tooltip content='Stop'>
                                  <button
                                      type='button'
                                      aria-label={`Stop ${model.name}`}
                                      disabled={model.sending}
                                      onClick={actions.stop}
                                      className={cn(iconButton, 'hover:text-destructive')}
                                  >
                                      <Square className='size-3.5' aria-hidden />
                                  </button>
                              </Tooltip>
                          )
                        : permissions.start && (
                              <Tooltip content='Start'>
                                  <button
                                      type='button'
                                      aria-label={`Start ${model.name}`}
                                      disabled={model.sending}
                                      onClick={actions.start}
                                      className={cn(iconButton, 'hover:text-success')}
                                  >
                                      <Play className='size-3.5' aria-hidden />
                                  </button>
                              </Tooltip>
                          ))}
                <span
                    aria-hidden
                    className='grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:translate-x-0.5'
                >
                    <ArrowRight className='size-4' />
                </span>
            </div>
            {customizing && (
                <Suspense fallback={null}>
                    <CustomizeServer server={server} onClose={() => setCustomizing(false)} />
                </Suspense>
            )}
        </div>
    );
}

function CustomizeButton({ server, name, onClick }: { server: SdkServer; name: string; onClick: () => void }) {
    if (!can(server, 'file.update')) return null;

    return (
        <Tooltip content='Customize'>
            <button
                type='button'
                aria-label={`Customize ${name}`}
                onClick={onClick}
                className={cn(iconButton, 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
            >
                <Paintbrush className='size-3.5' aria-hidden />
            </button>
        </Tooltip>
    );
}
