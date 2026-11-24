export function bytes(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const n = value / 1024 ** i;
    return `${n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(n >= 10 ? 1 : 2)} ${units[i]}`;
}
