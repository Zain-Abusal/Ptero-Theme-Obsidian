import type { ServerRunState, ServerStatMetric } from '@pterodactyl/sdk/theme';

/** A limit of 0 is unlimited, which has no fraction. */
export const fraction = ({ value, limit }: Pick<ServerStatMetric, 'value' | 'limit'>): number | null =>
    limit > 0 ? Math.min(value / limit, 1) : null;

/** "3d 7h", "4h 12m", "52s": the two largest units of an uptime in milliseconds. */
export function uptime(ms: number): string {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);

    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}

/** "GiB" style sizes with one decimal, for tight tiles. */
export function bytes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const n = value / 1024 ** i;

    return `${n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(n >= 10 ? 1 : 2)} ${units[i]}`;
}

export const partOfDay = (date = new Date()): 'morning' | 'afternoon' | 'evening' | 'night' => {
    const h = date.getHours();
    if (h < 5) return 'night';
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    return h < 22 ? 'evening' : 'night';
};

export const stateLabel: Record<ServerRunState, string> = {
    offline: 'Offline',
    starting: 'Starting',
    running: 'Running',
    stopping: 'Stopping',
};

/** The tone of a run state, for badges and status dots. */
export const stateTone = (state: ServerRunState | null | undefined) =>
    state === 'running' ? 'success' : state === 'starting' || state === 'stopping' ? 'warning' : 'neutral';
