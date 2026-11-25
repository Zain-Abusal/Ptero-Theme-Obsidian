export interface CommandEntry {
    name: string;
    args?: readonly string[];
}

export interface Suggestion {
    text: string;
    source: 'command' | 'history';
}

export const COMMANDS: readonly CommandEntry[] = [
    { name: 'stop' },
    { name: 'restart' },
    { name: 'reload', args: ['confirm'] },
    { name: 'save-all', args: ['flush'] },
    { name: 'save-on' },
    { name: 'save-off' },
    { name: 'tps' },
    { name: 'mspt' },
    { name: 'timings', args: ['on', 'off', 'paste', 'report', 'reset'] },
    { name: 'help' },
    { name: 'list' },
    { name: 'op' },
    { name: 'deop' },
    { name: 'kick' },
    { name: 'ban' },
    { name: 'ban-ip' },
    { name: 'banlist', args: ['ips', 'players'] },
    { name: 'pardon' },
    { name: 'pardon-ip' },
    { name: 'whitelist', args: ['add', 'remove', 'list', 'on', 'off', 'reload'] },
    { name: 'give' },
    { name: 'kill' },
    { name: 'tp' },
    { name: 'gamemode', args: ['survival', 'creative', 'adventure', 'spectator'] },
    { name: 'defaultgamemode', args: ['survival', 'creative', 'adventure', 'spectator'] },
    { name: 'time', args: ['set', 'add', 'query'] },
    { name: 'weather', args: ['clear', 'rain', 'thunder'] },
    {
        name: 'gamerule',
        args: [
            'keepInventory',
            'doDaylightCycle',
            'doWeatherCycle',
            'mobGriefing',
            'doMobSpawning',
            'doFireTick',
            'naturalRegeneration',
            'announceAdvancements',
        ],
    },
    { name: 'difficulty', args: ['peaceful', 'easy', 'normal', 'hard'] },
    { name: 'seed' },
    { name: 'worldborder', args: ['set', 'add', 'center', 'damage', 'warning', 'get'] },
    { name: 'say' },
    { name: 'tell' },
    { name: 'msg' },
    { name: 'me' },
    { name: 'title' },
    { name: 'clear' },
    { name: 'enchant' },
    { name: 'effect', args: ['give', 'clear'] },
    { name: 'plugins' },
    { name: 'pl' },
    { name: 'version' },
    { name: 'ver' },
    { name: 'about' },
    { name: 'paper', args: ['reload', 'version', 'entity'] },
    { name: 'purpur', args: ['reload', 'version'] },
];

const LIMIT = 8;

export function getSuggestions(input: string, history: readonly string[]): Suggestion[] {
    const raw = input.trimStart();
    if (!raw) return [];

    const query = raw.toLowerCase();
    const results: Suggestion[] = [];
    const seen = new Set<string>();

    for (const item of history) {
        const clean = item.trim();
        if (!clean) continue;
        const lower = clean.toLowerCase();
        if (!lower.startsWith(query) || seen.has(lower)) continue;
        seen.add(lower);
        results.push({ text: clean, source: 'history' });
        if (results.length >= LIMIT) return results;
    }

    const space = raw.indexOf(' ');
    if (space === -1) {
        for (const cmd of COMMANDS) {
            const lower = cmd.name.toLowerCase();
            if (!lower.startsWith(query) || seen.has(lower)) continue;
            seen.add(lower);
            results.push({ text: cmd.name, source: 'command' });
            if (results.length >= LIMIT) return results;
        }
        return results;
    }

    const base = raw.slice(0, space).toLowerCase();
    const argQuery = raw
        .slice(space + 1)
        .trimStart()
        .toLowerCase();
    const entry = COMMANDS.find((cmd) => cmd.name.toLowerCase() === base);
    if (!entry?.args) return results;

    for (const arg of entry.args) {
        if (!arg.toLowerCase().startsWith(argQuery)) continue;
        const candidate = `${entry.name} ${arg}`;
        const lower = candidate.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        results.push({ text: candidate, source: 'command' });
        if (results.length >= LIMIT) return results;
    }

    return results;
}
