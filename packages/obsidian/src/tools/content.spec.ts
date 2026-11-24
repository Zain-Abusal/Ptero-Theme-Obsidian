import { afterEach, expect, test, vi } from 'vitest';
import { fetchAsFile, installMany, type Entry } from './lib/api';
import { cfLoaderType, cfToProject, type CfMod } from './lib/curseforge';
import { mergeInto, planMrpack, type MrIndex } from './lib/modpack';
import { modrinthDownload, modrinthLoaders } from './lib/sources';

afterEach(() => vi.unstubAllGlobals());

const zip = (size = 8) => new Uint8Array([0x50, 0x4b, ...new Array(Math.max(0, size - 2)).fill(1)]);
const ok = (body: BodyInit, headers: Record<string, string> = {}) => Promise.resolve(new Response(body, { status: 200, headers }));

test('maps a CurseForge project, marking ones that forbid third-party downloads as external', () => {
    const mod: CfMod = {
        id: 31043,
        name: 'WorldEdit',
        slug: 'worldedit',
        summary: 'In-game map editor',
        downloadCount: 1234,
        dateModified: '2026-01-01T00:00:00Z',
        logo: { thumbnailUrl: 'https://media.forgecdn.net/thumb.png' },
        authors: [{ name: 'sk89q' }],
        links: { websiteUrl: 'https://www.curseforge.com/minecraft/bukkit-plugins/worldedit' },
        categories: [{ name: 'World Editing' }],
        allowModDistribution: false,
    };

    expect(cfToProject(mod)).toMatchObject({
        source: 'curseforge',
        id: '31043',
        title: 'WorldEdit',
        author: 'sk89q',
        icon: 'https://media.forgecdn.net/thumb.png',
        external: true,
    });
    expect(cfLoaderType(['purpur', 'fabric'])).toBe(4);
    expect(cfLoaderType(['paper'])).toBeNull();
});

test('plans an mrpack: server files only, folders split from names, unsafe paths refused, loader found', () => {
    const index: MrIndex = {
        formatVersion: 1,
        name: 'Pack',
        versionId: '1.0',
        dependencies: { minecraft: '1.21.4', 'fabric-loader': '0.16.10' },
        files: [
            { path: 'mods/lithium.jar', downloads: ['https://cdn.modrinth.com/a.jar'], env: { client: 'required', server: 'required' } },
            { path: 'mods/sodium.jar', downloads: ['https://cdn.modrinth.com/b.jar'], env: { client: 'required', server: 'unsupported' } },
            { path: 'config/x/y.json', downloads: ['https://cdn.modrinth.com/c.json'] },
            { path: '../evil.jar', downloads: ['https://cdn.modrinth.com/d.jar'] },
            { path: '/etc/passwd', downloads: ['https://cdn.modrinth.com/e'] },
        ],
    };
    const plan = planMrpack(index);

    expect(plan.downloads).toEqual([
        { url: 'https://cdn.modrinth.com/a.jar', directory: '/mods', filename: 'lithium.jar' },
        { url: 'https://cdn.modrinth.com/c.json', directory: '/config/x', filename: 'y.json' },
    ]);
    expect(plan.skipped).toBe(1);
    expect(plan.unsafe).toEqual(['../evil.jar', '/etc/passwd']);
    expect(plan.minecraft).toBe('1.21.4');
    expect(plan.loader).toEqual({ kind: 'fabric', version: '0.16.10' });
});

test('merges overrides into the server root: new entries move, folders merge, files replace', async () => {
    const tree: Record<string, Entry[]> = {
        '/overrides': [entry('config', false), entry('options.txt', true), entry('kubejs', false)],
        '/': [entry('config', false), entry('options.txt', true), entry('overrides', false)],
        '/overrides/config': [entry('a.toml', true), entry('b.toml', true)],
        '/config': [entry('a.toml', true)],
    };
    const ops: string[] = [];
    const fs = {
        list: async (dir: string) => tree[dir] ?? [],
        rename: async (_root: string, from: string, to: string) => void ops.push(`mv ${from} ${to}`),
        remove: async (_root: string, files: string[]) => void ops.push(`rm ${files.join(',')}`),
    };

    expect(await mergeInto(fs, 'overrides')).toBe(4);
    expect(ops).toEqual([
        'rm config/a.toml',
        'mv overrides/config/a.toml config/a.toml',
        'mv overrides/config/b.toml config/b.toml',
        'rm options.txt',
        'mv overrides/options.txt options.txt',
        'mv overrides/kubejs kubejs',
    ]);
});

test('downloads in the browser only when it can: CORS, size and archive checks fall back to the server', async () => {
    expect(await fetchAsFile('https://x/a.jar', 'a.jar', 100, () => Promise.reject(new TypeError('Failed to fetch')))).toBeNull();
    expect(await fetchAsFile('https://x/a.jar', 'a.jar', 100, () => ok(zip(), { 'content-length': '500' }))).toBeNull();
    expect(await fetchAsFile('https://x/a.jar', 'a.jar', 100, () => ok('<html>blocked</html>'))).toBeNull();
    expect(await fetchAsFile('https://x/a.jar', 'a.jar', 100, () => Promise.resolve(new Response('', { status: 404 })))).toBeNull();

    const file = await fetchAsFile('https://x/a.jar', 'a.jar', 100, () => ok(zip()));
    expect(file?.name).toBe('a.jar');
    expect(file?.size).toBe(8);
});

test('installs many files: uploads per folder in batches, pulls what the browser cannot fetch, reports rate limits', async () => {
    const uploads: string[] = [];
    const pulls: string[] = [];
    const api = {
        upload: async (directory: string, files: File[]) => void uploads.push(`${directory}:${files.map((f) => f.name).join(',')}`),
        pull: async (url: string) => {
            pulls.push(url);
            if (url.includes('limited')) throw Object.assign(new Error('Too Many Requests'), { response: { status: 429 } });
        },
    };
    const fetcher = ((url: string) => (url.includes('github') || url.includes('limited') ? Promise.reject(new TypeError('cors')) : ok(zip()))) as typeof fetch;
    const results: string[] = [];

    const summary = await installMany(
        api,
        [
            { url: 'https://cdn.modrinth.com/1.jar', directory: '/mods', filename: '1.jar' },
            { url: 'https://cdn.modrinth.com/2.jar', directory: '/mods', filename: '2.jar' },
            { url: 'https://cdn.modrinth.com/c.jar', directory: '/config', filename: 'c.jar' },
            { url: 'https://github.com/x.jar', directory: '/plugins', filename: 'x.jar' },
            { url: 'https://limited.example/y.jar', directory: '/plugins', filename: 'y.jar' },
        ],
        { fetcher, concurrency: 2, onFile: (item, result) => results.push(`${item.filename}:${result}`) }
    );

    expect(uploads.sort()).toEqual(['/config:c.jar', '/mods:1.jar,2.jar']);
    expect(pulls).toEqual(['https://github.com/x.jar', 'https://limited.example/y.jar']);
    expect(summary.uploaded).toBe(3);
    expect(summary.pulled).toBe(1);
    expect(summary.failed[0].error).toContain('5 server downloads every 10 minutes');
    expect(results).toContain('x.jar:pull');
    expect(results).toContain('y.jar:failed');
});

test('picks the primary file and its sha1, falling back from the requested Minecraft version', async () => {
    const versions = [
        {
            version_number: '1.11',
            loaders: ['minecraft'],
            game_versions: ['1.21.4'],
            files: [
                { url: 'https://cdn.modrinth.com/extra.zip', filename: 'extra.zip', primary: false, size: 1, hashes: { sha1: 'bad' } },
                { url: 'https://cdn.modrinth.com/pack.zip', filename: 'Pack v1.zip', primary: true, size: 2, hashes: { sha1: 'abc123' } },
            ],
        },
    ];
    const fetchMock = vi.fn((url: string) => ok(JSON.stringify(url.includes('game_versions') ? [] : versions)));
    vi.stubGlobal('fetch', fetchMock);

    const file = await modrinthDownload('fresh-animations', modrinthLoaders('resourcepack', ['paper']), '1.99');

    expect(file).toMatchObject({ url: 'https://cdn.modrinth.com/pack.zip', filename: 'Pack-v1.zip', sha1: 'abc123', exact: false });
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent('["minecraft"]'));
    expect(modrinthLoaders('datapack', ['paper'])).toEqual(['datapack']);
    expect(modrinthLoaders('modpack', ['paper'])).toEqual([]);
});

function entry(name: string, isFile: boolean): Entry {
    return { name, isFile, size: 0, modifiedAt: '' };
}
