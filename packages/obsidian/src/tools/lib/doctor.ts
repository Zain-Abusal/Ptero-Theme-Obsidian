/** A problem the doctor found in a log or crash report. */
export interface Finding {
    readonly id: string;
    readonly severity: 'critical' | 'warning' | 'info';
    readonly title: string;
    readonly cause: string;
    readonly fixes: readonly string[];
    readonly lines: readonly string[];
    /** A toolkit page that fixes it, such as "versions". */
    readonly page?: string;
}

/** Class file major version → the Java release that reads it. */
export const CLASS_TO_JAVA: Readonly<Record<number, number>> = {
    52: 8,
    53: 9,
    54: 10,
    55: 11,
    56: 12,
    57: 13,
    58: 14,
    59: 15,
    60: 16,
    61: 17,
    62: 18,
    63: 19,
    64: 20,
    65: 21,
    66: 22,
    67: 23,
    68: 24,
    69: 25,
};

interface Rule {
    readonly id: string;
    readonly test: RegExp;
    readonly build: (match: RegExpMatchArray, lines: string[], all: string[]) => Omit<Finding, 'id' | 'lines'>;
}

const RULES: readonly Rule[] = [
    {
        id: 'java-version',
        test: /UnsupportedClassVersionError.*class file version (\d+)(?:\.\d+)?(?:.*?up to (\d+))?/i,
        build: (m) => {
            const needs = CLASS_TO_JAVA[Number(m[1])];
            const has = m[2] ? CLASS_TO_JAVA[Number(m[2])] : undefined;
            return {
                severity: 'critical',
                title: `Needs Java ${needs ?? 'newer'}${has ? `, running Java ${has}` : ''}`,
                cause: `The server or a plugin was built for Java ${needs ?? 'a newer release'}, and the Java in this server's image is older.`,
                fixes: [
                    `Pick Java ${needs ?? 'a newer version'} under Java runtime on the Versions page, then restart.`,
                    'Or use a server/plugin version made for your Java.',
                ],
                page: 'versions',
            };
        },
    },
    {
        id: 'eula',
        test: /You need to agree to the EULA/i,
        build: () => ({
            severity: 'critical',
            title: 'The EULA is not accepted',
            cause: 'Minecraft will not start until eula.txt says eula=true.',
            fixes: ['Set eula=true in eula.txt, or reinstall from the Versions page with "Accept the EULA" on.'],
            page: 'versions',
        }),
    },
    {
        id: 'jar-missing',
        test: /(Unable to access jarfile\s*(\S+)|Could not find or load main class\s*(\S+)|Error: Invalid or corrupt jarfile\s*(\S+))/i,
        build: (m) => ({
            severity: 'critical',
            title: 'The server jar is missing or broken',
            cause: `Java could not run ${m[2] ?? m[3] ?? m[4] ?? 'the server jar'}. It was deleted, renamed, or the download did not finish.`,
            fixes: [
                'Install a server version from the Versions page.',
                'Check the jar name matches "Server Jar File" in Startup.',
            ],
            page: 'versions',
        }),
    },
    {
        id: 'port',
        test: /(FAILED TO BIND TO PORT|Address already in use|BindException)/i,
        build: () => ({
            severity: 'critical',
            title: 'The port is already in use',
            cause: 'Another process (often a second copy of this server, or a plugin like Votifier or a web map) is using the same port.',
            fixes: [
                'Make sure server-port in server.properties matches the allocation, and leave server-ip empty.',
                'Give plugins that open ports (Votifier, BlueMap, Dynmap, Geyser) their own allocation.',
                'Kill the server and start it again in case an old process is still holding the port.',
            ],
            page: 'properties',
        }),
    },
    {
        id: 'memory',
        test: /(java\.lang\.OutOfMemoryError[^\n]*|There is insufficient memory for the Java Runtime)/i,
        build: (m) => ({
            severity: 'critical',
            title: 'Out of memory',
            cause: `Java ran out of memory (${m[1].replace(/^.*OutOfMemoryError:?\s*/i, '') || 'heap'}). Too many players or chunks, a memory leak in a plugin, or the limit is too low.`,
            fixes: [
                'Lower view-distance and simulation-distance on the Properties page.',
                'Pre-generate the world from the Worlds page so chunks are not generated while players explore.',
                'Remove recently added plugins or mods, or ask for more memory.',
            ],
            page: 'properties',
        }),
    },
    {
        id: 'watchdog',
        test: /(The server has stopped responding|A single server tick took|Watchdog Thread)/i,
        build: () => ({
            severity: 'warning',
            title: 'The server froze',
            cause: 'A tick took so long that the watchdog stepped in. A plugin, a huge redstone or entity farm, or world generation is blocking the main thread.',
            fixes: [
                'Look at the lines below for the plugin named in the thread dump.',
                'Pre-generate the world, and use spark (/spark profiler) to find the slow part.',
            ],
            page: 'worlds',
        }),
    },
    {
        id: 'dependency',
        test: /(Unknown\/missing dependency plugins: \[([^\]]+)\]|Could not load '([^']+)'.*?\n?.*?Unknown dependency|depends on (\S+) which is missing|requires plugin (\S+))/i,
        build: (m) => {
            const names = (m[2] ?? m[4] ?? m[5] ?? '').replace(/[[\]]/g, '');
            return {
                severity: 'warning',
                title: names ? `Missing plugin: ${names}` : 'A plugin is missing a dependency',
                cause: `${m[3] ? `${m[3].split('/').pop()} needs` : 'A plugin needs'} another plugin that is not installed${names ? `: ${names}` : ''}.`,
                fixes: [`Install ${names || 'the missing plugin'} from the Plugins page, then restart.`],
                page: 'plugins',
            };
        },
    },
    {
        id: 'plugin-enable',
        test: /Error occurred while enabling (\S+)/i,
        build: (m) => ({
            severity: 'warning',
            title: `${m[1]} failed to start`,
            cause: `${m[1]} threw an error while enabling. It is usually built for another Minecraft version, or its config is broken.`,
            fixes: [
                `Update ${m[1]} to a build for this Minecraft version on the Plugins page.`,
                `Check its config in plugins/${m[1]}/ for typos.`,
            ],
            page: 'plugins',
        }),
    },
    {
        id: 'plugin-load',
        test: /Could not load '?(plugins\/[^' ]+\.jar)'? in folder/i,
        build: (m) => ({
            severity: 'warning',
            title: `${m[1].split('/').pop()} could not load`,
            cause: 'The jar is not a plugin for this server type, is corrupt, or needs a newer server version.',
            fixes: ['Remove it or replace it with a build for this server from the Plugins page.'],
            page: 'plugins',
        }),
    },
    {
        id: 'duplicate',
        test: /Ambiguous plugin name `?([^`'\s]+)`?/i,
        build: (m) => ({
            severity: 'warning',
            title: `${m[1]} is installed twice`,
            cause: 'Two jars in plugins/ have the same plugin name, so only one of them loads.',
            fixes: [`Delete the older ${m[1]} jar on the Plugins page.`],
            page: 'plugins',
        }),
    },
    {
        id: 'fabric',
        test: /(Mod resolution failed|Incompatible mods? found|Incompatible mod set)/i,
        build: () => ({
            severity: 'critical',
            title: 'Fabric could not load the mods',
            cause: 'A mod needs another mod, a different Minecraft version, or conflicts with another mod. The lines below name them.',
            fixes: [
                'Install the missing mods, or remove the ones named as incompatible, on the Mods page.',
                'Client-only mods (shaders, minimaps, HUDs) do not belong on a server.',
            ],
            page: 'mods',
        }),
    },
    {
        id: 'world-corrupt',
        test: /(Exception reading .*level\.dat|Failed to load level|Couldn't load chunk|Chunk file at \[.*\] is in the wrong location)/i,
        build: () => ({
            severity: 'warning',
            title: 'World data problems',
            cause: 'Parts of the world could not be read, often after a crash or a full disk.',
            fixes: ['Restore a backup from the Backups page.', 'Check the server is not out of disk space.'],
            page: 'worlds',
        }),
    },
];

/** A few lines of context around a match. */
function around(lines: string[], index: number, before = 1, after = 3): string[] {
    return lines.slice(Math.max(0, index - before), Math.min(lines.length, index + after + 1));
}

/** Runs every rule over the text and returns one finding per rule, critical first. */
export function diagnose(text: string): Finding[] {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const findings: Finding[] = [];

    for (const rule of RULES) {
        for (let i = 0; i < lines.length; i++) {
            // Some messages continue on the next line, so each test sees two lines.
            const window = `${lines[i]}\n${lines[i + 1] ?? ''}`;
            const match = window.match(rule.test);
            if (!match) continue;
            findings.push({ id: rule.id, ...rule.build(match, around(lines, i), lines), lines: around(lines, i) });
            break;
        }
    }

    const rank = { critical: 0, warning: 1, info: 2 };
    return findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** The last `count` lines of a log. */
export const tail = (text: string, count: number) => text.replace(/\r\n/g, '\n').split('\n').slice(-count).join('\n');

/** Uploads a log to mclo.gs and returns its public URL. The log leaves the panel. */
export async function shareLog(content: string): Promise<string> {
    const response = await fetch('https://api.mclo.gs/1/log', {
        method: 'POST',
        body: new URLSearchParams({ content: content.slice(-10_000_000) }),
    });
    const data = (await response.json()) as { success: boolean; url?: string; error?: string };
    if (!data.success || !data.url) throw new Error(data.error ?? 'mclo.gs did not accept the log.');
    return data.url;
}

export interface Analysis {
    readonly problems: { message: string; solutions: { message: string }[] }[];
    readonly information: { label: string; value: string }[];
}

/** mclo.gs's own analysis of a log. The log leaves the panel. */
export async function analyseLog(content: string): Promise<Analysis> {
    const response = await fetch('https://api.mclo.gs/1/analyse', {
        method: 'POST',
        body: new URLSearchParams({ content: content.slice(-10_000_000) }),
    });
    if (!response.ok) throw new Error(`mclo.gs answered ${response.status}.`);
    const data = (await response.json()) as { analysis?: Analysis };
    return data.analysis ?? { problems: [], information: [] };
}
