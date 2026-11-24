import { getJson, safeName } from './api';
import type { Software } from './minecraft';

export interface VersionFamily {
    readonly name: string;
    readonly versions: string[];
}

export interface Download {
    readonly url: string;
    readonly filename: string;
    readonly build: string | null;
}

export interface Provider {
    readonly id: Exclude<Software, 'spigot' | 'forge' | 'neoforge' | 'unknown'>;
    readonly label: string;
    readonly blurb: string;
    readonly kind: 'server' | 'proxy';
    versions(): Promise<VersionFamily[]>;
    resolve(version: string): Promise<Download>;
}

const familyOf = (version: string) =>
    version.startsWith('1.') ? version.split('.').slice(0, 2).join('.') : version.split('.')[0];

function group(versions: string[], keepUnstable = false): VersionFamily[] {
    const stable = keepUnstable ? versions : versions.filter((v) => !/(pre|rc|snapshot|-)/i.test(v));
    const families = new Map<string, string[]>();
    for (const version of stable)
        families.set(familyOf(version), [...(families.get(familyOf(version)) ?? []), version]);
    return [...families.entries()].map(([name, list]) => ({ name, versions: list }));
}

function fill(id: 'paper' | 'folia' | 'velocity', label: string, blurb: string, kind: Provider['kind']): Provider {
    const api = `https://fill.papermc.io/v3/projects/${id}`;

    return {
        id,
        label,
        blurb,
        kind,
        async versions() {
            const data = await getJson<{ versions: Record<string, string[]> }>(api);
            return group(Object.values(data.versions).flat(), id === 'velocity');
        },
        async resolve(version) {
            const build = await getJson<{ id: number; downloads: Record<string, { name: string; url: string }> }>(
                `${api}/versions/${version}/builds/latest`
            );
            const file = build.downloads['server:default'];
            if (!file) throw new Error(`${label} ${version} has no server download.`);
            return { url: file.url, filename: file.name, build: String(build.id) };
        },
    };
}

export const providers: Provider[] = [
    fill('paper', 'Paper', 'Fast, plugin-friendly, the best default.', 'server'),
    {
        id: 'purpur',
        label: 'Purpur',
        blurb: 'Paper plus hundreds of extra options.',
        kind: 'server',
        async versions() {
            const data = await getJson<{ versions: string[] }>('https://api.purpurmc.org/v2/purpur');
            return group([...data.versions].reverse());
        },
        async resolve(version) {
            return {
                url: `https://api.purpurmc.org/v2/purpur/${version}/latest/download`,
                filename: `purpur-${version}.jar`,
                build: 'latest',
            };
        },
    },
    fill('folia', 'Folia', 'Multithreaded Paper for huge worlds.', 'server'),
    {
        id: 'vanilla',
        label: 'Vanilla',
        blurb: 'The official Mojang server.',
        kind: 'server',
        async versions() {
            const data = await getJson<{ versions: { id: string; type: string }[] }>(
                'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
            );
            return group(data.versions.filter((v) => v.type === 'release').map((v) => v.id));
        },
        async resolve(version) {
            const manifest = await getJson<{ versions: { id: string; url: string }[] }>(
                'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
            );
            const entry = manifest.versions.find((v) => v.id === version);
            if (!entry) throw new Error(`Mojang has no ${version}.`);
            const detail = await getJson<{ downloads: { server?: { url: string } } }>(entry.url);
            if (!detail.downloads.server) throw new Error(`${version} has no server download.`);
            return { url: detail.downloads.server.url, filename: `minecraft_server.${version}.jar`, build: null };
        },
    },
    {
        id: 'fabric',
        label: 'Fabric',
        blurb: 'Lightweight loader for mods.',
        kind: 'server',
        async versions() {
            const data = await getJson<{ version: string; stable: boolean }[]>(
                'https://meta.fabricmc.net/v2/versions/game'
            );
            return group(data.filter((v) => v.stable).map((v) => v.version));
        },
        resolve: (version) => fabricServerJar(version),
    },
    fill('velocity', 'Velocity', 'Proxy that links your servers.', 'proxy'),
];

export const providerById = (id: string) => providers.find((p) => p.id === id);

export async function fabricServerJar(minecraft: string, loaderVersion?: string): Promise<Download> {
    const [loaders, installers] = await Promise.all([
        loaderVersion
            ? Promise.resolve([{ version: loaderVersion, stable: true }])
            : getJson<{ version: string; stable: boolean }[]>('https://meta.fabricmc.net/v2/versions/loader'),
        getJson<{ version: string; stable: boolean }[]>('https://meta.fabricmc.net/v2/versions/installer'),
    ]);
    const loader = loaders.find((l) => l.stable) ?? loaders[0];
    const installer = installers.find((i) => i.stable) ?? installers[0];

    return {
        url: `https://meta.fabricmc.net/v2/versions/loader/${minecraft}/${loader.version}/${installer.version}/server/jar`,
        filename: safeName(`fabric-server-${minecraft}-${loader.version}.jar`),
        build: loader.version,
    };
}

export function jarOf(
    startup:
        | { data: { attributes: { env_variable: string; server_value: string | null; default_value: string } }[] }
        | undefined
): string {
    const variable = startup?.data.find((v) => v.attributes.env_variable === 'SERVER_JARFILE')?.attributes;
    return variable?.server_value || variable?.default_value || 'server.jar';
}
