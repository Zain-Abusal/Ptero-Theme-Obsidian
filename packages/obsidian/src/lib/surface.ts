import { useStored } from './storage';

export const SURFACES = [
    { id: 'graphite', label: 'Graphite', swatch: 'oklch(0.2 0 0)' },
    { id: 'midnight', label: 'Midnight', swatch: 'oklch(0.22 0.05 262)' },
    { id: 'nord', label: 'Nord', swatch: 'oklch(0.24 0.04 235)' },
    { id: 'forest', label: 'Forest', swatch: 'oklch(0.22 0.04 158)' },
    { id: 'ember', label: 'Ember', swatch: 'oklch(0.22 0.035 45)' },
    { id: 'rose', label: 'Rosé', swatch: 'oklch(0.22 0.04 355)' },
    { id: 'amethyst', label: 'Amethyst', swatch: 'oklch(0.22 0.05 300)' },
    { id: 'oled', label: 'OLED', swatch: '#000' },
] as const;

export type SurfaceId = (typeof SURFACES)[number]['id'];

export function applyStoredSurface(): void {
    try {
        const raw = window.localStorage.getItem('obsidian:surface');
        const id = raw ? (JSON.parse(raw) as string) : null;
        if (id && SURFACES.some((s) => s.id === id)) document.documentElement.dataset.obsSurface = id;
    } catch {}
}

export function useSurface(): [SurfaceId | null, (id: SurfaceId | null) => void] {
    const [stored, setStored] = useStored<SurfaceId | null>('surface', null);
    const fallback = document.documentElement.dataset.obsDefaultSurface;

    return [
        stored,
        (id) => {
            setStored(id);
            const html = document.documentElement;
            const next = id ?? fallback ?? 'graphite';
            const swap = () => {
                html.dataset.obsSurface = next;
            };
            withTransition(swap);
        },
    ];
}

export function withTransition(change: () => void, origin?: { x: number; y: number }): void {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!doc.startViewTransition || reduced) return change();

    const html = document.documentElement;
    if (origin) {
        const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
        html.style.setProperty('--obs-vt-x', `${origin.x}px`);
        html.style.setProperty('--obs-vt-y', `${origin.y}px`);
        html.style.setProperty('--obs-vt-r', `${r}px`);
    }
    html.classList.add('obs-scheme-switching');
    doc.startViewTransition(change).finished.finally(() => html.classList.remove('obs-scheme-switching'));
}
