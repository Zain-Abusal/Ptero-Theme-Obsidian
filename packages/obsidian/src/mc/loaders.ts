export const STARTER_URL = 'https://github.com/NeoForged/ServerStarterJar/releases/latest/download/server.jar';
export const NEOFORGE_MAVEN = 'https://maven.neoforged.net/releases/net/neoforged/neoforge';
export const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge';

export type ModLoader = 'forge' | 'neoforge';

export interface LoaderBuild {
    readonly minecraft: string;
    readonly loader: string;
    readonly stable: boolean;
}

const numbers = (version: string) => version.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : -1));

export function compareVersions(a: string, b: string): number {
    const x = numbers(a);
    const y = numbers(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (x[i] ?? 0) - (y[i] ?? 0);
        if (d !== 0) return d;
    }
    return 0;
}

export function neoforgeMinecraft(version: string): string | null {
    if (/^0\.|craftmine|snapshot/i.test(version)) return null;
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
    if (!match) return null;
    const [, a, b, c] = match;
    if (Number(a) >= 25) return c === '0' ? `${a}.${b}` : `${a}.${b}.${c}`;
    return b === '0' ? `1.${a}` : `1.${a}.${b}`;
}

const atLeast117 = (minecraft: string) => !minecraft.startsWith('1.') || compareVersions(minecraft, '1.17') >= 0;

export function parseMavenVersions(xml: string): string[] {
    return [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
}

export function latestBuilds(loader: ModLoader, versions: readonly string[]): LoaderBuild[] {
    const best = new Map<string, LoaderBuild>();
    for (const version of versions) {
        let build: LoaderBuild | null = null;
        if (loader === 'neoforge') {
            const minecraft = neoforgeMinecraft(version);
            if (minecraft) build = { minecraft, loader: version, stable: !/beta|alpha/i.test(version) };
        } else {
            const match = /^(\d+\.\d+(?:\.\d+)?)-(\d+(?:\.\d+)*)$/.exec(version);
            if (match) build = { minecraft: match[1], loader: match[2], stable: true };
        }
        if (!build || !atLeast117(build.minecraft)) continue;
        const current = best.get(build.minecraft);
        const better =
            !current ||
            (build.stable && !current.stable) ||
            (build.stable === current.stable && compareVersions(build.loader, current.loader) > 0);
        if (better) best.set(build.minecraft, build);
    }
    return [...best.values()].sort((a, b) => compareVersions(b.minecraft, a.minecraft));
}

export function installerFor(loader: ModLoader, build: Pick<LoaderBuild, 'minecraft' | 'loader'>) {
    if (loader === 'neoforge') {
        const filename = `neoforge-${build.loader}-installer.jar`;
        return { url: `${NEOFORGE_MAVEN}/${build.loader}/${filename}`, filename };
    }
    const id = `${build.minecraft}-${build.loader}`;
    const filename = `forge-${id}-installer.jar`;
    return { url: `${FORGE_MAVEN}/${id}/${filename}`, filename };
}

export async function loaderBuilds(loader: ModLoader, fetcher: typeof fetch = fetch): Promise<LoaderBuild[]> {
    const response = await fetcher(`${loader === 'neoforge' ? NEOFORGE_MAVEN : FORGE_MAVEN}/maven-metadata.xml`);
    if (!response.ok)
        throw new Error(`The ${loader === 'neoforge' ? 'NeoForge' : 'Forge'} maven answered ${response.status}.`);
    return latestBuilds(loader, parseMavenVersions(await response.text()));
}

export const LOADER_CLEANUP = ['run.sh', 'run.bat'];
