import type { Entry, InstallItem, InstallSummary, ServerApi } from './api';
import { MARKER } from './minecraft';
import { cfDownload, cfFile, cfLatestFile } from './curseforge';
import { modrinthDownload } from './sources';
import { fabricServerJar } from './software';

/** The parts of a Modrinth `modrinth.index.json` the installer reads (format version 1). */
export interface MrIndex {
    readonly formatVersion: number;
    readonly name: string;
    readonly versionId: string;
    readonly dependencies: Readonly<Record<string, string>>;
    readonly files: readonly {
        readonly path: string;
        readonly downloads: readonly string[];
        readonly env?: { readonly client?: string; readonly server?: string };
        readonly fileSize?: number;
    }[];
}

export type LoaderKind = 'fabric' | 'quilt' | 'forge' | 'neoforge';

export interface MrPlan {
    readonly downloads: InstallItem[];
    /** Client-only files the server does not need. */
    readonly skipped: number;
    /** Paths that tried to leave the server folder; never installed. */
    readonly unsafe: string[];
    readonly minecraft: string | null;
    readonly loader: { kind: LoaderKind; version: string } | null;
}

const LOADER_KEYS: Record<string, LoaderKind> = {
    'fabric-loader': 'fabric',
    'quilt-loader': 'quilt',
    forge: 'forge',
    neoforge: 'neoforge',
};

/** A relative path inside the server folder: no leading slash, no `..`, no drive letters. */
const isSafe = (path: string) =>
    path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !/^[a-z]:/i.test(path) && path.split('/').every((part) => part !== '..' && part !== '');

/** Turns a pack index into the downloads the server needs. */
export function planMrpack(index: MrIndex): MrPlan {
    const downloads: InstallItem[] = [];
    const unsafe: string[] = [];
    let skipped = 0;

    for (const file of index.files) {
        if (file.env?.server === 'unsupported') {
            skipped++;
            continue;
        }
        if (!isSafe(file.path) || !file.downloads[0]) {
            unsafe.push(file.path);
            continue;
        }
        const parts = file.path.split('/');
        const filename = parts.pop()!;
        downloads.push({ url: file.downloads[0], directory: `/${parts.join('/')}`, filename });
    }

    const loaderKey = Object.keys(index.dependencies).find((key) => key in LOADER_KEYS);

    return {
        downloads,
        skipped,
        unsafe,
        minecraft: index.dependencies.minecraft ?? null,
        loader: loaderKey ? { kind: LOADER_KEYS[loaderKey], version: index.dependencies[loaderKey] } : null,
    };
}

export interface MergeFs {
    list(directory: string): Promise<Entry[]>;
    rename(root: string, from: string, to: string): Promise<void>;
    remove(root: string, files: string[]): Promise<void>;
}

const join = (a: string, b: string) => (a ? `${a}/${b}` : b);

/**
 * Moves everything in `source` into `target` (both relative to the server root). Folders that exist on
 * both sides are merged; files in `source` replace files in `target`. Returns how many entries moved.
 */
export async function mergeInto(fs: MergeFs, source: string, target = '', depth = 0): Promise<number> {
    if (depth > 16) throw new Error(`${source} is nested too deeply to merge.`);
    const entries = await fs.list(`/${source}`);
    const existing = new Map((await fs.list(`/${target}`)).map((e) => [e.name, e]));
    let moved = 0;

    for (const entry of entries) {
        const from = join(source, entry.name);
        const to = join(target, entry.name);
        const there = existing.get(entry.name);
        if (!there) {
            await fs.rename('/', from, to);
            moved++;
        } else if (!entry.isFile && !there.isFile) {
            moved += await mergeInto(fs, from, to, depth + 1);
        } else {
            await fs.remove('/', [to]);
            await fs.rename('/', from, to);
            moved++;
        }
    }

    return moved;
}

export interface PackContext {
    readonly api: ServerApi;
    /** The node's upload limit in MiB. */
    readonly maxMb: number;
    /** The jar the egg starts. */
    readonly jar: string;
    readonly log: (line: string) => void;
    readonly onFile?: (item: InstallItem, result: 'upload' | 'pull' | 'failed') => void;
}

const ARCHIVE = 'obsidian-pack.zip';
const LOADER_NAMES: Record<LoaderKind, string> = { fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge' };

async function installLoader(ctx: PackContext, plan: Pick<MrPlan, 'loader' | 'minecraft'>): Promise<void> {
    const { api, log } = ctx;
    if (!plan.loader || !plan.minecraft) {
        log('The pack names no loader, so the current server jar is kept.');
        return;
    }
    if (plan.loader.kind !== 'fabric') {
        log(`This pack runs on ${LOADER_NAMES[plan.loader.kind]} ${plan.loader.version}, which has to be installed with its installer. Use a ${LOADER_NAMES[plan.loader.kind]} egg or its installer jar; the mods and configs are in place.`);
        return;
    }
    log(`Installing Fabric ${plan.loader.version} for Minecraft ${plan.minecraft}…`);
    const jar = await fabricServerJar(plan.minecraft, plan.loader.version);
    await api.remove('/', [ctx.jar]).catch(() => undefined);
    await api.install(jar.url, '/', ctx.jar, { maxMb: ctx.maxMb });
    await api.write(`/${MARKER}`, JSON.stringify({ software: 'fabric', version: plan.minecraft, build: jar.build, installedAt: new Date().toISOString() }, null, 2));
}

function report(log: (line: string) => void, summary: InstallSummary): void {
    log(`Downloaded ${summary.uploaded + summary.pulled} files${summary.pulled ? ` (${summary.pulled} by the server)` : ''}.`);
    for (const { item, error } of summary.failed) log(`✗ ${item.directory}/${item.filename}: ${error}`);
}

/** Installs a Modrinth modpack: unpack the .mrpack on the server, fetch its files, apply its overrides, set up Fabric. */
export async function installModrinthPack(ctx: PackContext, projectId: string, gameVersion: string | null): Promise<InstallSummary> {
    const { api, log } = ctx;
    log('Finding the newest version of the pack…');
    const pack = await modrinthDownload(projectId, [], gameVersion);
    if (!pack.exact && gameVersion) log(`No version is marked for ${gameVersion}; using the newest.`);

    log(`Downloading ${pack.filename}…`);
    await api.install(pack.url, '/', ARCHIVE, { maxMb: ctx.maxMb });
    log('Unpacking it on the server…');
    await api.decompress('/', ARCHIVE);

    const index = JSON.parse(await api.read('/modrinth.index.json')) as MrIndex;
    const plan = planMrpack(index);
    log(`${index.name} ${index.versionId}: ${plan.downloads.length} files for the server, ${plan.skipped} client-only skipped.`);
    for (const path of plan.unsafe) log(`✗ Skipped ${path}: it points outside the server folder.`);

    const summary = await api.installMany(plan.downloads, { maxMb: ctx.maxMb, onFile: ctx.onFile });
    report(log, summary);

    const root = (await api.listOrEmpty('/')).map((e) => e.name);
    for (const folder of ['overrides', 'server-overrides']) {
        if (!root.includes(folder)) continue;
        log(`Applying ${folder}…`);
        const moved = await mergeInto(api, folder);
        log(`Moved ${moved} entries from ${folder}.`);
    }

    await installLoader(ctx, plan);
    log('Cleaning up…');
    const leftovers = [ARCHIVE, 'modrinth.index.json', ...['overrides', 'server-overrides'].filter((n) => root.includes(n))];
    await api.remove('/', leftovers).catch(() => undefined);
    log('Done.');

    return summary;
}

/**
 * Installs a CurseForge modpack from its server pack. A server pack that unpacks into one folder is
 * merged up into the server root.
 */
export async function installCurseForgePack(ctx: PackContext, cfKey: string, projectId: string, page: string, gameVersion: string | null): Promise<void> {
    const { api, log } = ctx;
    log('Finding the server pack…');
    const { file } = await cfLatestFile(cfKey, projectId, gameVersion, []);
    if (!file.serverPackFileId) throw new Error(`${file.fileName} has no server pack on CurseForge. Download one from ${page} and use the Importer.`);
    const serverPack = cfDownload(await cfFile(cfKey, projectId, file.serverPackFileId), page);

    const before = new Set((await api.listOrEmpty('/')).map((e) => e.name));
    log(`Downloading ${serverPack.filename}…`);
    await api.install(serverPack.url, '/', ARCHIVE, { maxMb: ctx.maxMb });
    log('Unpacking it on the server…');
    await api.decompress('/', ARCHIVE);
    await api.remove('/', [ARCHIVE]);

    const added = (await api.listOrEmpty('/')).filter((e) => !before.has(e.name));
    if (added.length === 1 && !added[0].isFile) {
        log(`Moving ${added[0].name} up into the server folder…`);
        await mergeInto(api, added[0].name);
        await api.remove('/', [added[0].name]).catch(() => undefined);
    }
    log('Done. CurseForge server packs often ship their own start script or loader installer; check the pack’s readme for the jar to run.');
}
