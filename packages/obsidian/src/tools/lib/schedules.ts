import { http } from '@pterodactyl/sdk';

/** Tasks wait at most this long after the one before them (CreateScheduleTask: time_offset max:900). */
export const MAX_OFFSET = 900;
/** The panel's default per-schedule task limit (PTERODACTYL_PER_SCHEDULE_TASK_LIMIT). */
export const TASK_LIMIT = 10;
/** Schedules Obsidian creates are named with this prefix, so the page lists only its own. */
export const PREFIX = '[Obsidian] ';

export interface PlannedTask {
    readonly action: 'command' | 'power';
    readonly payload: string;
    readonly time_offset: number;
}

export interface RestartPlan {
    /** Seconds between the schedule firing and the restart. */
    readonly lead: number;
    readonly tasks: PlannedTask[];
}

/** "10 minutes", "1 minute", "30 seconds", "1 minute 30 seconds". */
export function spell(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
    if (m && s) return `${part(m, 'minute')} ${part(s, 'second')}`;
    return m ? part(m, 'minute') : part(s, 'second');
}

/**
 * The tasks for a restart with in-game warnings. `warnings` are seconds before the restart. The
 * schedule fires on a whole minute, so the first task waits the leftover seconds; any gap longer than
 * the panel's 900-second limit gets an extra warning in between, so no offset ever exceeds it.
 */
export function planRestart(warnings: readonly number[], template: string): RestartPlan {
    const marks = [...new Set(warnings.filter((w) => Number.isFinite(w) && w > 0).map((w) => Math.round(w)))].sort(
        (a, b) => b - a
    );

    // Fill gaps the panel cannot wait through with extra warnings.
    const filled: number[] = [];
    for (const mark of marks) {
        const previous = filled[filled.length - 1];
        if (previous !== undefined) {
            let at = previous;
            while (at - mark > MAX_OFFSET) {
                at -= MAX_OFFSET;
                filled.push(at);
            }
        }
        filled.push(mark);
    }
    // The last warning to the restart itself.
    if (filled.length) {
        let at = filled[filled.length - 1];
        while (at > MAX_OFFSET) {
            at -= MAX_OFFSET;
            filled.push(at);
        }
    }

    const longest = filled[0] ?? 0;
    const lead = Math.ceil(longest / 60) * 60;
    const say = (seconds: number) => `say ${template.replace(/\{time\}/g, spell(seconds))}`;

    const tasks: PlannedTask[] = [];
    let clock = lead;
    for (const mark of filled) {
        tasks.push({ action: 'command', payload: say(mark), time_offset: clock - mark });
        clock = mark;
    }
    tasks.push({ action: 'power', payload: 'restart', time_offset: clock });

    return { lead, tasks };
}

export interface Cron {
    readonly minute: string;
    readonly hour: string;
    readonly day_of_week: string;
}

/**
 * The cron fields for a schedule that fires `lead` seconds before `time` ("HH:MM") on `days`
 * (0 = Sunday). Firing before midnight moves each day back by one.
 */
export function cronFor(time: string, days: readonly number[], lead: number): Cron {
    const [h, m] = time.split(':').map(Number);
    let start = h * 60 + m - lead / 60;
    let shift = 0;
    while (start < 0) {
        start += 24 * 60;
        shift -= 1;
    }
    const all = days.length === 0 || days.length === 7;
    const shifted = [...new Set(days.map((d) => (((d + shift) % 7) + 7) % 7))].sort((a, b) => a - b);

    return {
        minute: String(Math.round(start % 60)),
        hour: String(Math.floor(start / 60)),
        day_of_week: all ? '*' : shifted.join(','),
    };
}

/** "Mon, Wed" style list for cron days, or "Every day". */
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// #region API
export interface Schedule {
    readonly id: number;
    readonly name: string;
    readonly cron: { minute: string; hour: string; day_of_week: string; day_of_month: string; month: string };
    readonly is_active: boolean;
    readonly only_when_online: boolean;
    readonly next_run_at: string | null;
    readonly last_run_at: string | null;
    readonly tasks: { action: string; payload: string; time_offset: number }[];
}

interface ScheduleResponse {
    attributes: Omit<Schedule, 'tasks'> & {
        relationships?: {
            tasks?: { data: { attributes: { action: string; payload: string; time_offset: number } }[] };
        };
    };
}

const base = (id: string) => `/api/client/servers/${id}/schedules`;

const toSchedule = ({ attributes: a }: ScheduleResponse): Schedule => ({
    id: a.id,
    name: a.name,
    cron: a.cron,
    is_active: a.is_active,
    only_when_online: a.only_when_online,
    next_run_at: a.next_run_at,
    last_run_at: a.last_run_at,
    tasks: (a.relationships?.tasks?.data ?? []).map((t) => t.attributes),
});

export async function listSchedules(id: string): Promise<Schedule[]> {
    const { data } = await http.get<{ data: ScheduleResponse[] }>(base(id), { params: { include: 'tasks' } });
    return data.data.map(toSchedule);
}

export async function createRestart(
    id: string,
    input: { name: string; cron: Cron; onlyWhenOnline: boolean; plan: RestartPlan }
): Promise<void> {
    const { data } = await http.post<ScheduleResponse>(base(id), {
        name: `${PREFIX}${input.name}`,
        minute: input.cron.minute,
        hour: input.cron.hour,
        day_of_month: '*',
        month: '*',
        day_of_week: input.cron.day_of_week,
        is_active: true,
        only_when_online: input.onlyWhenOnline,
    });
    const scheduleId = data.attributes.id;
    try {
        for (const task of input.plan.tasks) {
            await http.post(`${base(id)}/${scheduleId}/tasks`, { ...task, continue_on_failure: true });
        }
    } catch (error) {
        // Leave no half-built schedule behind.
        await http.delete(`${base(id)}/${scheduleId}`).catch(() => undefined);
        throw error;
    }
}

/** The update route validates every cron field, so it sends the schedule back whole. */
export async function setActive(id: string, schedule: Schedule, active: boolean): Promise<void> {
    await http.post(`${base(id)}/${schedule.id}`, {
        name: schedule.name,
        minute: schedule.cron.minute,
        hour: schedule.cron.hour,
        day_of_month: schedule.cron.day_of_month,
        month: schedule.cron.month,
        day_of_week: schedule.cron.day_of_week,
        is_active: active,
        only_when_online: schedule.only_when_online,
    });
}

export const deleteSchedule = (id: string, schedule: Schedule) => http.delete(`${base(id)}/${schedule.id}`);
// #endregion
