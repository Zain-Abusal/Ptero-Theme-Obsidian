import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Clock, Megaphone, Plus, RotateCw, Trash2, X } from 'lucide-react';
import {
    Alert,
    Badge,
    Button,
    Dialog,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    Spinner,
    Switch,
    cn,
    formatDate,
    toast,
    useServerPermission,
} from '@pterodactyl/sdk';
import {
    DAY_NAMES,
    PREFIX,
    TASK_LIMIT,
    createRestart,
    cronFor,
    deleteSchedule,
    listSchedules,
    planRestart,
    setActive,
    spell,
    type Schedule,
} from '../lib/schedules';
import { useToolkit } from '../lib/useToolkit';
import Page, { Panel, Step, attempt } from '../ui/Page';

const WARNING_CHOICES = [1800, 900, 600, 300, 120, 60, 30, 10, 5];
const short = (s: number) => (s >= 60 ? `${s / 60}m` : `${s}s`);

/** "04:00 · Mon, Wed" for a schedule Obsidian made, reading the restart time back from its tasks. */
function describe(schedule: Schedule): string {
    const lead = schedule.tasks.reduce((sum, t) => sum + t.time_offset, 0);
    const start = Number(schedule.cron.hour) * 60 + Number(schedule.cron.minute);
    if (Number.isNaN(start)) return `${schedule.cron.hour}:${schedule.cron.minute}`;
    let at = start + Math.round(lead / 60);
    let shift = 0;
    while (at >= 24 * 60) {
        at -= 24 * 60;
        shift += 1;
    }
    const time = `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
    const days =
        schedule.cron.day_of_week === '*'
            ? 'every day'
            : schedule.cron.day_of_week
                  .split(',')
                  .map((d) => DAY_NAMES[(Number(d) + shift) % 7] ?? d)
                  .join(', ');
    return `${time} · ${days}`;
}

function Creator({ onDone }: { onDone: () => void }) {
    const { id } = useToolkit();
    const [times, setTimes] = useState<string[]>(['04:00']);
    const [days, setDays] = useState<number[]>([]);
    const [warnings, setWarnings] = useState<number[]>([600, 300, 60, 10]);
    const [template, setTemplate] = useState('§cServer restarting in {time}!');
    const [onlineOnly, setOnlineOnly] = useState(true);
    const [busy, setBusy] = useState(false);
    const plan = useMemo(() => planRestart(warnings, template), [warnings, template]);
    const tooMany = plan.tasks.length > TASK_LIMIT;

    const toggleDay = (d: number) => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);
    const toggleWarning = (w: number) =>
        setWarnings(warnings.includes(w) ? warnings.filter((x) => x !== w) : [...warnings, w]);

    const create = async () => {
        setBusy(true);
        const ok = await attempt(
            async () => {
                for (const time of times) {
                    await createRestart(id, {
                        name: `Restart ${time}${
                            days.length && days.length < 7
                                ? ` (${[...days]
                                      .sort()
                                      .map((d) => DAY_NAMES[d])
                                      .join(', ')})`
                                : ''
                        }`,
                        cron: cronFor(time, days, plan.lead),
                        onlyWhenOnline: onlineOnly,
                        plan,
                    });
                }
                return true;
            },
            `Created ${times.length} restart schedule${times.length === 1 ? '' : 's'}.`,
            toast
        );
        setBusy(false);
        if (ok) onDone();
    };

    return (
        <Panel title='New restart schedule'>
            <div className='flex flex-col gap-6'>
                <div>
                    <Step n={1}>When</Step>
                    <div className='flex flex-wrap items-center gap-2'>
                        {times.map((time, i) => (
                            <span
                                key={i}
                                className='flex items-center gap-1 rounded-full border border-border bg-background pr-1 pl-3'
                            >
                                <Clock className='size-3.5 text-muted-foreground' aria-hidden />
                                <input
                                    type='time'
                                    value={time}
                                    onChange={(e) => setTimes(times.map((t, j) => (j === i ? e.target.value : t)))}
                                    aria-label={`Restart time ${i + 1}`}
                                    className='h-8 border-0 bg-transparent p-1 font-mono text-sm focus:ring-0'
                                />
                                {times.length > 1 && (
                                    <button
                                        type='button'
                                        aria-label='Remove this time'
                                        onClick={() => setTimes(times.filter((_, j) => j !== i))}
                                        className='grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted'
                                    >
                                        <X className='size-3' aria-hidden />
                                    </button>
                                )}
                            </span>
                        ))}
                        {times.length < 6 && (
                            <Button size='xsmall' color='grey' onClick={() => setTimes([...times, '16:00'])}>
                                <Plus className='size-3.5' aria-hidden /> Add time
                            </Button>
                        )}
                    </div>
                    <div className='mt-3 flex flex-wrap gap-1.5' role='group' aria-label='Days'>
                        {DAY_NAMES.map((name, d) => (
                            <button
                                key={name}
                                type='button'
                                aria-pressed={days.includes(d)}
                                onClick={() => toggleDay(d)}
                                className={cn(
                                    'h-8 w-11 rounded-full border text-xs font-semibold transition',
                                    days.includes(d)
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border hover:bg-muted'
                                )}
                            >
                                {name}
                            </button>
                        ))}
                        <span className='self-center pl-1 text-xs text-muted-foreground'>
                            {days.length === 0 || days.length === 7
                                ? 'Every day'
                                : `${days.length} day${days.length === 1 ? '' : 's'} a week`}
                        </span>
                    </div>
                </div>

                <div>
                    <Step n={2}>Warnings in chat</Step>
                    <div className='flex flex-wrap gap-1.5' role='group' aria-label='Warnings'>
                        {WARNING_CHOICES.map((w) => (
                            <button
                                key={w}
                                type='button'
                                aria-pressed={warnings.includes(w)}
                                onClick={() => toggleWarning(w)}
                                className={cn(
                                    'h-8 rounded-full border px-3 font-mono text-xs transition',
                                    warnings.includes(w)
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : 'border-border hover:bg-muted'
                                )}
                            >
                                {short(w)}
                            </button>
                        ))}
                    </div>
                    <label className='mt-3 flex items-center gap-2 rounded-lg border border-input-border bg-input px-3'>
                        <Megaphone className='size-4 text-muted-foreground' aria-hidden />
                        <input
                            value={template}
                            onChange={(e) => setTemplate(e.target.value)}
                            aria-label='Warning message'
                            className='h-10 min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm focus:ring-0'
                        />
                    </label>
                    <p className='mt-1.5 text-xs text-muted-foreground'>
                        {'{time}'} becomes "{spell(warnings[0] ?? 60)}". Colour codes like §c work.
                    </p>
                </div>

                <div>
                    <Step n={3}>What runs</Step>
                    <ol className='relative flex flex-col gap-2 border-l border-border pl-4'>
                        {plan.tasks.map((task, i) => (
                            <li key={i} className='relative text-sm'>
                                <span
                                    className={cn(
                                        'absolute top-1.5 -left-[1.3rem] size-2 rounded-full',
                                        task.action === 'power' ? 'bg-warning' : 'bg-border'
                                    )}
                                />
                                <span className='mr-2 font-mono text-xs text-muted-foreground'>
                                    +{task.time_offset}s
                                </span>
                                {task.action === 'power' ? (
                                    <strong className='inline-flex items-center gap-1'>
                                        <RotateCw className='size-3.5' aria-hidden /> Restart
                                    </strong>
                                ) : (
                                    <span className='font-mono text-xs'>{task.payload}</span>
                                )}
                            </li>
                        ))}
                    </ol>
                    {tooMany && (
                        <Alert type='warning' className='mt-3'>
                            This needs {plan.tasks.length} tasks and the panel allows {TASK_LIMIT} per schedule by
                            default. Pick fewer warnings.
                        </Alert>
                    )}
                </div>

                <div className='flex flex-wrap items-center gap-4 border-t border-border pt-5'>
                    <Switch
                        checked={onlineOnly}
                        onChange={() => setOnlineOnly(!onlineOnly)}
                        label='Only while online'
                        description='Skip the restart when the server is already off'
                    />
                    <div className='ml-auto flex gap-2'>
                        <Button color='grey' onClick={onDone} disabled={busy}>
                            Cancel
                        </Button>
                        <Button onClick={create} isLoading={busy} disabled={busy || tooMany || times.length === 0}>
                            Create
                        </Button>
                    </div>
                </div>
            </div>
        </Panel>
    );
}

/** Automatic restarts with countdown warnings, built on the panel's own schedules. */
export default function SchedulerScreen() {
    const { id } = useToolkit();
    const client = useQueryClient();
    const canCreate = useServerPermission('schedule.create');
    const canUpdate = useServerPermission('schedule.update');
    const canDelete = useServerPermission('schedule.delete');
    const [creating, setCreating] = useState(false);
    const [removing, setRemoving] = useState<Schedule | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const key = ['obsidian-mc', id, 'schedules'];
    const schedules = useQuery({ queryKey: key, queryFn: () => listSchedules(id) });
    const ours = (schedules.data ?? []).filter((s) => s.name.startsWith(PREFIX));
    const others = (schedules.data ?? []).length - ours.length;
    const refresh = () => client.invalidateQueries({ queryKey: key });

    const toggle = async (schedule: Schedule) => {
        setBusy(schedule.id);
        await attempt(
            () => setActive(id, schedule, !schedule.is_active),
            schedule.is_active ? 'Paused.' : 'Resumed.',
            toast
        );
        await refresh();
        setBusy(null);
    };

    return (
        <Page
            title='Restarts'
            description='Automatic restarts with countdown warnings in chat.'
            actions={
                !creating &&
                canCreate && (
                    <Button onClick={() => setCreating(true)}>
                        <Plus className='size-4' aria-hidden /> New schedule
                    </Button>
                )
            }
        >
            <p className='text-xs text-muted-foreground'>
                Times are in the panel's timezone, which can differ from yours. The next run below shows exactly when it
                fires.
            </p>
            {creating && (
                <Creator
                    onDone={() => {
                        setCreating(false);
                        void refresh();
                    }}
                />
            )}
            {schedules.isLoading && <Spinner size='large' centered />}
            {schedules.isError && <Alert type='danger'>Could not load schedules.</Alert>}
            {!schedules.isLoading && ours.length === 0 && !creating && (
                <Empty className='rounded-xl border border-border py-10'>
                    <EmptyHeader>
                        <EmptyMedia variant='icon'>
                            <CalendarClock />
                        </EmptyMedia>
                        <EmptyTitle>No restart schedules</EmptyTitle>
                        <EmptyDescription>
                            A daily restart clears lag and memory leaks. Players get a countdown first.
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
            {ours.length > 0 && (
                <ul className='flex flex-col gap-2.5'>
                    {ours.map((schedule) => (
                        <li
                            key={schedule.id}
                            className={cn(
                                'flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-border bg-card px-4 py-3.5',
                                !schedule.is_active && 'opacity-60'
                            )}
                        >
                            <span className='grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-muted'>
                                <RotateCw className='size-4' aria-hidden />
                            </span>
                            <div className='min-w-0 flex-1 basis-48'>
                                <p className='truncate font-semibold'>{schedule.name.slice(PREFIX.length)}</p>
                                <p className='font-mono text-xs text-muted-foreground'>{describe(schedule)}</p>
                            </div>
                            <div className='text-xs text-muted-foreground'>
                                <p>
                                    Next:{' '}
                                    <span className='text-foreground'>
                                        {schedule.is_active && schedule.next_run_at
                                            ? formatDate(schedule.next_run_at, 'ddd D MMM, HH:mm')
                                            : 'paused'}
                                    </span>
                                </p>
                                <p>{schedule.tasks.filter((t) => t.action === 'command').length} warnings</p>
                            </div>
                            {schedule.only_when_online && (
                                <Badge size='sm' tone='neutral' variant='soft'>
                                    Only while online
                                </Badge>
                            )}
                            <div className='flex items-center gap-2'>
                                <Switch
                                    checked={schedule.is_active}
                                    disabled={!canUpdate || busy === schedule.id}
                                    onChange={() => toggle(schedule)}
                                    aria-label={schedule.is_active ? 'Pause' : 'Resume'}
                                />
                                {canDelete && (
                                    <button
                                        type='button'
                                        aria-label={`Delete ${schedule.name}`}
                                        onClick={() => setRemoving(schedule)}
                                        className='grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                                    >
                                        <Trash2 className='size-3.5' aria-hidden />
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {others > 0 && (
                <p className='text-xs text-muted-foreground'>
                    {others} other schedule{others === 1 ? '' : 's'} on this server {others === 1 ? 'is' : 'are'}{' '}
                    managed on the Schedules page.
                </p>
            )}
            <Dialog.Confirm
                open={removing !== null}
                onClose={() => setRemoving(null)}
                title='Delete this restart schedule?'
                confirm='Delete'
                onConfirmed={async () => {
                    if (!removing) return;
                    await attempt(() => deleteSchedule(id, removing), 'Deleted.', toast);
                    setRemoving(null);
                    await refresh();
                }}
            >
                {removing?.name.slice(PREFIX.length)} and its warnings stop running.
            </Dialog.Confirm>
        </Page>
    );
}
