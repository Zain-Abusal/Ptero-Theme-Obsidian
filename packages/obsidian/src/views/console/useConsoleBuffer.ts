import { useEffect, useRef, useState } from 'react';
import { http, useServerWebsocketEvent } from '@pterodactyl/sdk';
import { capLines, plainLine } from '../../tools/lib/ops-logs';

/** Lines kept for search, copy and download. */
export const BUFFER = 2000;

/**
 * The console as text: Wings' recent lines to start with, then every live line. Updates are batched
 * once per frame so a chatty server does not re-render the page per line.
 */
export function useConsoleBuffer(id: string): string[] {
    const enabled = id !== '';
    const [lines, setLines] = useState<string[]>([]);
    const pending = useRef<string[]>([]);
    const timer = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        http.get<{ attributes: { lines: string[] } }>(`/api/client/servers/${id}/logs`, { params: { lines: 100 } })
            .then(({ data }) => {
                if (!cancelled) setLines((now) => capLines([...data.attributes.lines.map(plainLine), ...now], BUFFER));
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [id, enabled]);

    useServerWebsocketEvent('console output', (data) => {
        if (!enabled) return;
        pending.current.push(
            ...data
                .split('\n')
                .map(plainLine)
                .filter((l) => l.trim() !== '')
        );
        if (timer.current !== null) return;
        timer.current = window.setTimeout(() => {
            timer.current = null;
            const batch = pending.current;
            pending.current = [];
            setLines((now) => capLines([...now, ...batch], BUFFER));
        }, 50);
    });

    useEffect(
        () => () => {
            if (timer.current !== null) window.clearTimeout(timer.current);
        },
        []
    );

    return lines;
}
