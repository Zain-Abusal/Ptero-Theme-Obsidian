export type Level = 'error' | 'warn' | 'info';

/** Strips ANSI colours and Minecraft § codes from a console line. */
export const plainLine = (line: string) =>
    line
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        .replace(/§./g, '')
        .replace(/\r/g, '');

/** The level of a console line, from its "[12:00:00 WARN]" style prefix or an exception. */
export function levelOf(line: string): Level {
    if (/\b(ERROR|SEVERE|FATAL)\b|Exception|^\s+at [\w.$]+\(/.test(line)) return 'error';
    if (/\bWARN(ING)?\b/.test(line)) return 'warn';
    return 'info';
}

/** Splits a line around every match of `term`, for highlighting. */
export function highlight(line: string, term: string): { text: string; match: boolean }[] {
    if (!term) return [{ text: line, match: false }];
    const parts: { text: string; match: boolean }[] = [];
    const lower = line.toLowerCase();
    const needle = term.toLowerCase();
    let at = 0;
    for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, at)) {
        if (i > at) parts.push({ text: line.slice(at, i), match: false });
        parts.push({ text: line.slice(i, i + needle.length), match: true });
        at = i + needle.length;
    }
    if (at < line.length) parts.push({ text: line.slice(at), match: false });
    return parts;
}

/** Keeps the newest `cap` lines. */
export const capLines = (lines: readonly string[], cap: number) =>
    lines.length > cap ? lines.slice(-cap) : [...lines];
