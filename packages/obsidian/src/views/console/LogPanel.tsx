import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@pterodactyl/sdk';
import { highlight, levelOf, type Level } from '../../tools/lib/ops-logs';

export type LevelFilter = 'all' | 'warn' | 'error';

const passes = (level: Level, filter: LevelFilter) => filter === 'all' || (filter === 'error' ? level === 'error' : level !== 'info');

/** The buffered console as text, filtered by level and search, newest at the bottom. */
export default function LogPanel({ lines, term, filter }: { lines: readonly string[]; term: string; filter: LevelFilter }) {
    const box = useRef<HTMLDivElement>(null);
    const shown = useMemo(() => {
        const needle = term.trim().toLowerCase();
        return lines
            .map((text, i) => ({ text, i, level: levelOf(text) }))
            .filter((l) => passes(l.level, filter) && (!needle || l.text.toLowerCase().includes(needle)));
    }, [lines, term, filter]);

    // Follow the newest line.
    useEffect(() => {
        if (box.current) box.current.scrollTop = box.current.scrollHeight;
    }, [shown.length]);

    return (
        <div ref={box} className='absolute inset-0 z-10 overflow-y-auto bg-terminal px-4 py-2 font-mono text-[0.78rem] leading-relaxed' role='log' aria-label='Filtered console'>
            {shown.length === 0 ? (
                <p className='py-8 text-center font-sans text-sm text-muted-foreground'>
                    {lines.length === 0 ? 'No console output yet.' : 'No lines match.'}
                </p>
            ) : (
                shown.map(({ text, i, level }) => (
                    <div
                        key={i}
                        className={cn(
                            'break-all whitespace-pre-wrap',
                            level === 'error' && 'text-destructive',
                            level === 'warn' && 'text-warning',
                            level === 'info' && 'text-terminal-foreground'
                        )}
                    >
                        {highlight(text, term.trim()).map((part, j) =>
                            part.match ? (
                                <mark key={j} className='rounded-sm bg-warning/35 text-inherit'>
                                    {part.text}
                                </mark>
                            ) : (
                                <span key={j}>{part.text}</span>
                            )
                        )}
                    </div>
                ))
            )}
        </div>
    );
}
