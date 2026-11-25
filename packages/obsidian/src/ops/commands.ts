import { useSaveServerMeta, useServerMeta } from '../lib/serverMeta';

export interface QuickCommand {
    readonly label: string;
    readonly command: string;
    readonly confirm?: boolean;
}

export const STARTER_COMMANDS: readonly QuickCommand[] = [
    { label: 'Save', command: 'save-all' },
    { label: 'Who is on', command: 'list' },
    { label: 'Whitelist on', command: 'whitelist on', confirm: true },
    { label: 'Whitelist off', command: 'whitelist off', confirm: true },
    { label: 'Clear weather', command: 'weather clear' },
    { label: 'Make it day', command: 'time set day' },
];

export const VISIBLE_COMMANDS = 6;

export function normaliseCommand(command: string): string {
    return command.trim().replace(/^\/+/, '');
}

export function cleanCommands(list: unknown): QuickCommand[] {
    if (!Array.isArray(list)) return [];
    return list
        .filter(
            (c): c is QuickCommand =>
                !!c && typeof c === 'object' && typeof c.label === 'string' && typeof c.command === 'string'
        )
        .map((c) => ({
            label: c.label.trim().slice(0, 32),
            command: normaliseCommand(c.command).slice(0, 255),
            ...(c.confirm ? { confirm: true } : {}),
        }))
        .filter((c) => c.label && c.command)
        .slice(0, 30);
}

export function moveCommand(list: readonly QuickCommand[], from: number, to: number): QuickCommand[] {
    if (to < 0 || to >= list.length || from === to) return [...list];
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
}

export function useQuickCommands(identifier: string) {
    const meta = useServerMeta(identifier) as { commands?: unknown };
    const save = useSaveServerMeta(identifier);

    return {
        commands: meta.commands === undefined ? [...STARTER_COMMANDS] : cleanCommands(meta.commands),
        save: (commands: readonly QuickCommand[]) => save({ commands: cleanCommands(commands) }),
    };
}
