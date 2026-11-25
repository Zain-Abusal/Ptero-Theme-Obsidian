import type { SdkServer } from '@pterodactyl/sdk';
import type { ServerApi } from './api';

export type Software =
    | 'paper'
    | 'purpur'
    | 'folia'
    | 'vanilla'
    | 'fabric'
    | 'velocity'
    | 'spigot'
    | 'forge'
    | 'neoforge'
    | 'unknown';

export interface Installed {
    readonly software: Software;
    readonly version: string | null;
    readonly build?: string | null;
}

export const MARKER = '.obsidian-software.json';

export function isMinecraft(server: SdkServer | undefined): boolean {
    if (!server) return false;
    const a = server.attributes;
    const features = (a.egg_features ?? []).map((f) => f.toLowerCase());
    const tags = (a.egg_tags ?? []).map((t) => t.toLowerCase());

    return (
        tags.includes('minecraft') ||
        features.includes('eula') ||
        features.includes('java_version') ||
        /\.jar\b/.test(a.invocation) ||
        /java|minecraft|yolks:java/i.test(a.docker_image)
    );
}

export const isProxy = (software: Software) => software === 'velocity';
export const isModded = (software: Software) =>
    software === 'fabric' || software === 'forge' || software === 'neoforge';

const fromHistory = (raw: string | null): string | null => {
    if (!raw) return null;
    try {
        const current = (JSON.parse(raw) as { currentVersion?: string }).currentVersion ?? '';
        return /MC: ([\w.-]+)/.exec(current)?.[1] ?? null;
    } catch {
        return null;
    }
};

export async function detect(api: ServerApi): Promise<Installed> {
    const marker = await api.readOrNull(`/${MARKER}`);
    if (marker) {
        try {
            const parsed = JSON.parse(marker) as Installed;
            if (parsed.software) return parsed;
        } catch {}
    }

    const [entries, history] = await Promise.all([api.listOrEmpty('/'), api.readOrNull('/version_history.json')]);
    const root = entries.map((e) => e.name.toLowerCase());
    const has = (name: string) => root.includes(name);
    const version = fromHistory(history);

    if (has('velocity.toml')) return { software: 'velocity', version };
    if (has('purpur.yml')) return { software: 'purpur', version };
    if (has('config') && (await api.listOrEmpty('/config')).some((e) => e.name === 'paper-global.yml'))
        return { software: root.some((n) => n.startsWith('folia')) ? 'folia' : 'paper', version };
    if (has('.fabric') || has('fabric-server-launch.jar') || has('fabric-server-launcher.properties'))
        return { software: 'fabric', version };
    if (has('libraries') && root.some((n) => n.includes('neoforge'))) return { software: 'neoforge', version };
    if (has('libraries') && root.some((n) => n.includes('forge'))) return { software: 'forge', version };
    if (has('spigot.yml')) return { software: 'spigot', version };
    if (has('server.properties')) return { software: 'vanilla', version };

    return { software: 'unknown', version };
}

export const softwareLabel: Record<Software, string> = {
    paper: 'Paper',
    purpur: 'Purpur',
    folia: 'Folia',
    vanilla: 'Vanilla',
    fabric: 'Fabric',
    velocity: 'Velocity',
    spigot: 'Spigot',
    forge: 'Forge',
    neoforge: 'NeoForge',
    unknown: 'Unknown',
};

export function loadersFor(software: Software): string[] {
    switch (software) {
        case 'folia':
            return ['folia'];
        case 'purpur':
            return ['purpur', 'paper', 'spigot', 'bukkit'];
        case 'paper':
            return ['paper', 'spigot', 'bukkit'];
        case 'spigot':
            return ['spigot', 'bukkit'];
        case 'velocity':
            return ['velocity'];
        case 'fabric':
            return ['fabric'];
        case 'forge':
            return ['forge'];
        case 'neoforge':
            return ['neoforge'];
        default:
            return ['paper', 'spigot', 'bukkit'];
    }
}
