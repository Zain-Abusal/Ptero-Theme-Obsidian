import type { SdkServer } from '@pterodactyl/sdk';
import type { ServerApi } from './api';

export type Software = 'paper' | 'purpur' | 'folia' | 'vanilla' | 'fabric' | 'velocity' | 'spigot' | 'forge' | 'neoforge' | 'unknown';

export interface Installed {
    readonly software: Software;
    readonly version: string | null;
    readonly build?: string | null;
}

/** The marker the Versions screen writes after an install, so later screens know exactly what runs. */
export const MARKER = '.obsidian-software.json';

/**
 * Whether a server runs Minecraft: Java eggs carry the `eula` or `java_version` feature, run a jar, or use a
 * Java image. Synchronous, so it can gate the navigation.
 */
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
export const isModded = (software: Software) => software === 'fabric' || software === 'forge' || software === 'neoforge';

/** Paper writes "1.21.4-232-abc (MC: 1.21.4)" into version_history.json. */
const fromHistory = (raw: string | null): string | null => {
    if (!raw) return null;
    try {
        const current = (JSON.parse(raw) as { currentVersion?: string }).currentVersion ?? '';
        return /MC: ([\w.-]+)/.exec(current)?.[1] ?? null;
    } catch {
        return null;
    }
};

/** What the server runs: the marker first, then the files each server type leaves behind. */
export async function detect(api: ServerApi): Promise<Installed> {
    const marker = await api.readOrNull(`/${MARKER}`);
    if (marker) {
        try {
            const parsed = JSON.parse(marker) as Installed;
            if (parsed.software) return parsed;
        } catch {
            // Fall through to the heuristics.
        }
    }

    const root = (await api.listOrEmpty('/')).map((e) => e.name.toLowerCase());
    const has = (name: string) => root.includes(name);
    const version = fromHistory(await api.readOrNull('/version_history.json'));

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

/** The loaders a server's plugins or mods are built for, for Modrinth's filters. */
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
