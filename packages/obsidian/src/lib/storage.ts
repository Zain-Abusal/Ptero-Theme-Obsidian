import { useSyncExternalStore } from 'react';

/**
 * Per-browser conveniences (pinned servers, recent servers, collapsed groups). Storage can be blocked
 * or empty, so every access is guarded and the UI works without it.
 */
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function read(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return memory.get(key) ?? null;
    }
}

function write(key: string, value: string): void {
    memory.set(key, value);
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Kept in memory for this page.
    }
    listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => event.key?.startsWith('obsidian:') && listener();
    window.addEventListener('storage', onStorage);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
};

/** A JSON value in storage that re-renders every reader when any of them writes it. */
export function useStored<T>(key: string, fallback: T): [T, (next: T) => void] {
    const raw = useSyncExternalStore(subscribe, () => read(`obsidian:${key}`), () => null);
    let value = fallback;
    try {
        value = raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
        value = fallback;
    }

    return [value, (next: T) => write(`obsidian:${key}`, JSON.stringify(next))];
}

export function usePins(): { pins: string[]; isPinned: (uuid: string) => boolean; toggle: (uuid: string) => void } {
    const [pins, setPins] = useStored<string[]>('pins', []);

    return {
        pins,
        isPinned: (uuid) => pins.includes(uuid),
        toggle: (uuid) => setPins(pins.includes(uuid) ? pins.filter((p) => p !== uuid) : [...pins, uuid]),
    };
}

/** Most recently opened servers first, by identifier. */
export function useRecent(): { recent: string[]; touch: (identifier: string) => void } {
    const [recent, setRecent] = useStored<string[]>('recent', []);

    return {
        recent,
        touch: (identifier) => {
            if (recent[0] !== identifier) setRecent([identifier, ...recent.filter((r) => r !== identifier)].slice(0, 20));
        },
    };
}
