/** A parsed server.properties: its lines as written, so saving keeps comments and order. */
export interface PropertiesFile {
    readonly lines: readonly string[];
    readonly values: Readonly<Record<string, string>>;
}

/** Java properties escape `:`, `=`, `#`, `!` and backslashes; Minecraft also writes `\uXXXX`. */
const unescape = (value: string) =>
    value.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, (_, hex: string | undefined, ch: string | undefined) =>
        hex ? String.fromCharCode(parseInt(hex, 16)) : ch === 'n' ? '\n' : ch === 't' ? '\t' : (ch ?? '')
    );

const escape = (value: string) =>
    value
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/([:=#!])/g, '\\$1')
        .replace(/[^\x20-\x7e]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);

const keyOf = (line: string) => {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) return null;
    const match = /^((?:\\.|[^=:\s\\])+)\s*[=:\s]\s*(.*)$/.exec(trimmed) ?? /^((?:\\.|[^=:\s\\])+)$/.exec(trimmed);
    return match ? { key: unescape(match[1]), value: unescape(match[2] ?? '') } : null;
};

export function parseProperties(text: string): PropertiesFile {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const values: Record<string, string> = {};
    for (const line of lines) {
        const entry = keyOf(line);
        if (entry) values[entry.key] = entry.value;
    }
    return { lines, values };
}

/** Writes changed values in place, appends new keys at the end, and leaves every other line as it was. */
export function serializeProperties(file: PropertiesFile, values: Readonly<Record<string, string>>): string {
    const seen = new Set<string>();
    const lines = file.lines.map((line) => {
        const entry = keyOf(line);
        if (!entry || !(entry.key in values)) return line;
        seen.add(entry.key);
        return entry.value === values[entry.key] ? line : `${entry.key}=${escape(values[entry.key])}`;
    });
    const added = Object.keys(values)
        .filter((key) => !seen.has(key))
        .map((key) => `${key}=${escape(values[key])}`);
    const body = [...lines];
    while (body.length && body[body.length - 1] === '') body.pop();

    return [...body, ...added, ''].join('\n');
}

export type FieldKind =
    | { readonly type: 'toggle' }
    | { readonly type: 'number'; readonly min?: number; readonly max?: number; readonly unit?: string }
    | { readonly type: 'select'; readonly options: Readonly<Record<string, string>> }
    | { readonly type: 'text' };

export interface Field {
    readonly key: string;
    readonly label: string;
    readonly help: string;
    readonly group: Group;
    readonly kind: FieldKind;
}

export type Group = 'Basics' | 'Who can join' | 'World' | 'Performance' | 'Extras';

export const GROUPS: readonly Group[] = ['Basics', 'Who can join', 'World', 'Performance', 'Extras'];

const toggle = { type: 'toggle' } as const;
const text = { type: 'text' } as const;
const num = (min?: number, max?: number, unit?: string) => ({ type: 'number', min, max, unit }) as const;
const select = (options: Record<string, string>) => ({ type: 'select', options }) as const;

/** Every setting a vanilla or Paper server.properties has, in plain words. Unknown keys still show under Advanced. */
export const FIELDS: readonly Field[] = [
    {
        key: 'motd',
        label: 'Message of the day',
        help: 'Shown under the name in the server list.',
        group: 'Basics',
        kind: text,
    },
    {
        key: 'max-players',
        label: 'Player slots',
        help: 'How many players can be online at once.',
        group: 'Basics',
        kind: num(1, 1000, 'players'),
    },
    {
        key: 'difficulty',
        label: 'Difficulty',
        help: '',
        group: 'Basics',
        kind: select({ peaceful: 'Peaceful', easy: 'Easy', normal: 'Normal', hard: 'Hard' }),
    },
    {
        key: 'gamemode',
        label: 'Game mode',
        help: 'The mode new players start in.',
        group: 'Basics',
        kind: select({ survival: 'Survival', creative: 'Creative', adventure: 'Adventure', spectator: 'Spectator' }),
    },
    {
        key: 'force-gamemode',
        label: 'Force game mode',
        help: 'Put players back in the default mode every time they join.',
        group: 'Basics',
        kind: toggle,
    },
    {
        key: 'hardcore',
        label: 'Hardcore',
        help: 'Players become spectators when they die.',
        group: 'Basics',
        kind: toggle,
    },
    { key: 'pvp', label: 'PvP', help: 'Players can hurt each other.', group: 'Basics', kind: toggle },

    {
        key: 'white-list',
        label: 'Whitelist',
        help: 'Only whitelisted players can join.',
        group: 'Who can join',
        kind: toggle,
    },
    {
        key: 'enforce-whitelist',
        label: 'Enforce whitelist',
        help: 'Kick players who are not whitelisted when the list is reloaded.',
        group: 'Who can join',
        kind: toggle,
    },
    {
        key: 'online-mode',
        label: 'Online mode',
        help: 'Check accounts with Mojang. Turn off only behind a proxy.',
        group: 'Who can join',
        kind: toggle,
    },
    {
        key: 'enforce-secure-profile',
        label: 'Secure chat profiles',
        help: 'Require players to sign their chat messages.',
        group: 'Who can join',
        kind: toggle,
    },
    {
        key: 'spawn-protection',
        label: 'Spawn protection',
        help: 'Radius around spawn only operators can build in.',
        group: 'Who can join',
        kind: num(0, 256, 'blocks'),
    },
    {
        key: 'op-permission-level',
        label: 'Operator level',
        help: 'What /op grants, from 1 (bypass spawn protection) to 4 (everything).',
        group: 'Who can join',
        kind: num(1, 4),
    },
    {
        key: 'player-idle-timeout',
        label: 'Idle kick',
        help: 'Minutes before idle players are kicked; 0 never kicks.',
        group: 'Who can join',
        kind: num(0, 1440, 'min'),
    },

    { key: 'level-name', label: 'World folder', help: 'The world the server loads.', group: 'World', kind: text },
    { key: 'level-seed', label: 'Seed', help: 'Used only when a new world is created.', group: 'World', kind: text },
    {
        key: 'level-type',
        label: 'World type',
        help: 'Used only when a new world is created.',
        group: 'World',
        kind: select({
            'minecraft:normal': 'Normal',
            'minecraft:flat': 'Flat',
            'minecraft:large_biomes': 'Large biomes',
            'minecraft:amplified': 'Amplified',
            'minecraft:single_biome_surface': 'Single biome',
        }),
    },
    {
        key: 'generate-structures',
        label: 'Structures',
        help: 'Generate villages, temples and other structures.',
        group: 'World',
        kind: toggle,
    },
    { key: 'allow-nether', label: 'Nether', help: 'Players can travel to the Nether.', group: 'World', kind: toggle },
    { key: 'spawn-monsters', label: 'Monsters', help: 'Hostile mobs spawn.', group: 'World', kind: toggle },
    {
        key: 'max-world-size',
        label: 'World border',
        help: 'The largest radius the world border can have.',
        group: 'World',
        kind: num(1, 29999984, 'blocks'),
    },

    {
        key: 'view-distance',
        label: 'View distance',
        help: 'Chunks sent to each player.',
        group: 'Performance',
        kind: num(2, 32, 'chunks'),
    },
    {
        key: 'simulation-distance',
        label: 'Simulation distance',
        help: 'Chunks around players that tick.',
        group: 'Performance',
        kind: num(2, 32, 'chunks'),
    },
    {
        key: 'entity-broadcast-range-percentage',
        label: 'Entity range',
        help: 'How far away entities are sent, as a percentage.',
        group: 'Performance',
        kind: num(10, 1000, '%'),
    },
    {
        key: 'network-compression-threshold',
        label: 'Compression threshold',
        help: 'Packets larger than this are compressed; -1 turns it off.',
        group: 'Performance',
        kind: num(-1, 65535, 'bytes'),
    },
    {
        key: 'max-tick-time',
        label: 'Watchdog',
        help: 'Milliseconds a tick may take before the server stops; -1 turns it off.',
        group: 'Performance',
        kind: num(-1, undefined, 'ms'),
    },
    {
        key: 'sync-chunk-writes',
        label: 'Synchronous chunk writes',
        help: 'Safer saves, slower disks.',
        group: 'Performance',
        kind: toggle,
    },

    {
        key: 'allow-flight',
        label: 'Allow flight',
        help: 'Stops the anti-cheat kicking players who fly with mods or plugins.',
        group: 'Extras',
        kind: toggle,
    },
    { key: 'enable-command-block', label: 'Command blocks', help: '', group: 'Extras', kind: toggle },
    { key: 'enable-rcon', label: 'RCON', help: 'Remote console over the network.', group: 'Extras', kind: toggle },
    {
        key: 'enable-query',
        label: 'Query',
        help: 'Lets server lists read the player count.',
        group: 'Extras',
        kind: toggle,
    },
    {
        key: 'enable-status',
        label: 'Show in server list',
        help: 'Answer server list pings.',
        group: 'Extras',
        kind: toggle,
    },
    {
        key: 'hide-online-players',
        label: 'Hide online players',
        help: 'Leave player names out of the server list.',
        group: 'Extras',
        kind: toggle,
    },
    { key: 'resource-pack', label: 'Resource pack URL', help: '', group: 'Extras', kind: text },
    {
        key: 'require-resource-pack',
        label: 'Require resource pack',
        help: 'Kick players who decline it.',
        group: 'Extras',
        kind: toggle,
    },
];

export const fieldByKey = new Map(FIELDS.map((f) => [f.key, f]));

/** The tiles at the top of the page, in order. */
export const QUICK = [
    'max-players',
    'difficulty',
    'gamemode',
    'white-list',
    'allow-flight',
    'view-distance',
    'simulation-distance',
    'hardcore',
    'spawn-protection',
] as const;

// #region MOTD
export interface MotdSpan {
    readonly text: string;
    readonly color: string | null;
    readonly bold: boolean;
    readonly italic: boolean;
    readonly underline: boolean;
    readonly strike: boolean;
}

/** Minecraft's sixteen chat colours. */
export const COLORS: Readonly<Record<string, string>> = {
    '0': '#000000',
    '1': '#0000aa',
    '2': '#00aa00',
    '3': '#00aaaa',
    '4': '#aa0000',
    '5': '#aa00aa',
    '6': '#ffaa00',
    '7': '#aaaaaa',
    '8': '#555555',
    '9': '#5555ff',
    a: '#55ff55',
    b: '#55ffff',
    c: '#ff5555',
    d: '#ff55ff',
    e: '#ffff55',
    f: '#ffffff',
};

/** Splits a MOTD with § or & codes (and §x hex colours) into styled spans. */
export function parseMotd(motd: string): MotdSpan[] {
    const spans: MotdSpan[] = [];
    let style = { color: null as string | null, bold: false, italic: false, underline: false, strike: false };
    let text = '';
    const push = () => {
        if (text) spans.push({ text, ...style });
        text = '';
    };

    for (let i = 0; i < motd.length; i++) {
        const ch = motd[i];
        const code = motd[i + 1]?.toLowerCase();
        if ((ch === '§' || ch === '&') && code) {
            if (code === 'x' && /^([§&][0-9a-f]){6}$/i.test(motd.slice(i + 2, i + 14))) {
                push();
                style = { ...style, color: `#${motd.slice(i + 2, i + 14).replace(/[§&]/g, '')}` };
                i += 13;
                continue;
            }
            if (code in COLORS) {
                push();
                style = { color: COLORS[code], bold: false, italic: false, underline: false, strike: false };
                i++;
                continue;
            }
            const flag = { l: 'bold', o: 'italic', n: 'underline', m: 'strike' }[code] as
                | keyof typeof style
                | undefined;
            if (flag) {
                push();
                style = { ...style, [flag]: true };
                i++;
                continue;
            }
            if (code === 'r') {
                push();
                style = { color: null, bold: false, italic: false, underline: false, strike: false };
                i++;
                continue;
            }
            if (code === 'k') {
                i++;
                continue;
            }
        }
        text += ch;
    }
    push();

    return spans;
}
// #endregion
