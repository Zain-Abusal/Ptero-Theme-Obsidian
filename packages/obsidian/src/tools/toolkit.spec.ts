import { expect, test, vi } from 'vitest';
import { parseMotd, parseProperties, serializeProperties } from './lib/properties';
import { parseList } from './screens/PlayersScreen';
import { readVotifierConfig, setVotifierPort } from './screens/VotifierScreen';
import { fileNameOf } from './screens/ImporterScreen';
import { looksInstalled } from './lib/sources';
import { detect, isMinecraft, loadersFor } from './lib/minecraft';
import type { ServerApi } from './lib/api';
import { createTestServer } from '@pterodactyl/sdk/testing';
import theme from '../theme';

test('edits server.properties in place, keeping comments, order and escapes', () => {
    const text =
        '#Minecraft server properties\n#Mon Nov 24\nmotd=A \\u00A7aMinecraft Server\nmax-players=20\nwhite-list=false\n';
    const file = parseProperties(text);

    expect(file.values.motd).toBe('A §aMinecraft Server');
    expect(file.values['max-players']).toBe('20');

    const out = serializeProperties(file, { ...file.values, 'max-players': '50', 'level-seed': 'abc' });
    expect(out).toBe(
        '#Minecraft server properties\n#Mon Nov 24\nmotd=A \\u00A7aMinecraft Server\nmax-players=50\nwhite-list=false\nlevel-seed=abc\n'
    );

    expect(serializeProperties(file, file.values)).toBe(text);
});

test('colours a MOTD from § and & codes', () => {
    const spans = parseMotd('§aGreen §lBold&r plain');

    expect(spans.map((s) => s.text)).toEqual(['Green ', 'Bold', ' plain']);
    expect(spans[0].color).toBe('#55ff55');
    expect(spans[1]).toMatchObject({ color: '#55ff55', bold: true });
    expect(spans[2]).toMatchObject({ color: null, bold: false });
});

test('reads both forms of the list command', () => {
    expect(parseList('[12:00:00 INFO]: There are 2 of a max of 20 players online: Alex, Steve')).toEqual({
        online: 2,
        max: 20,
        names: ['Alex', 'Steve'],
    });
    expect(parseList('There are 0 of a max of 10 players online:')).toEqual({ online: 0, max: 10, names: [] });

    expect(parseList('There are 1/20 players online:')).toEqual({ online: 1, max: 20, names: null });
    expect(parseList('Done (3.2s)! For help, type "help"')).toBeNull();
});

test('reads and moves the Votifier port without touching the rest of the config', () => {
    const yaml = 'host: 0.0.0.0\nport: 8192\ntokens:\n  default: abc123\n';

    expect(readVotifierConfig(yaml)).toEqual({ port: 8192, token: 'abc123' });
    expect(setVotifierPort(yaml, 25570)).toBe('host: 0.0.0.0\nport: 25570\ntokens:\n  default: abc123\n');
});

test('names imported files after their link', () => {
    expect(fileNameOf('https://cdn.example.com/worlds/My%20World.zip?dl=1')).toBe('My-World.zip');
    expect(fileNameOf('not a url')).toBe('import');
});

test('matches projects to installed jars by name', () => {
    const jars = ['LuckPerms-Bukkit-5.5.71.jar', 'Chunky-Bukkit-1.4.40.jar.disabled', 'worldedit-bukkit-7.3.jar'];

    expect(looksInstalled(jars, 'luckperms')).toBe(true);
    expect(looksInstalled(jars, 'chunky')).toBe(true);
    expect(looksInstalled(jars, 'worldguard')).toBe(false);

    expect(looksInstalled(jars, 'wo')).toBe(false);
});

test('shows the screens only on Minecraft servers', () => {
    expect(isMinecraft(createTestServer({ eggFeatures: ['eula', 'java_version'] }))).toBe(true);
    expect(isMinecraft(createTestServer({ eggTags: ['minecraft'] }))).toBe(true);
    expect(isMinecraft(undefined)).toBe(false);
    expect(loadersFor('purpur')).toContain('paper');
});

test('registers every screen the manifest declares, each with a visibility rule', async () => {
    const manifest = (await import('../../extension.json')).default as {
        ui: { screens: { id: string; when?: { runtime?: boolean } }[] };
    };
    const register = vi.fn();

    theme.setup!({
        meta: { id: 'obsidian-mc' },
        config: {},
        screens: { register },
        slots: { register: vi.fn() },
        views: { override: vi.fn() },
        columns: { register: vi.fn() },
        forms: { extend: vi.fn() },
    } as never);

    expect(register.mock.calls.map(([id]) => id).sort()).toEqual(manifest.ui.screens.map((s) => s.id).sort());
    expect(manifest.ui.screens.every((s) => s.when?.runtime === true)).toBe(true);
    expect(register.mock.calls.every(([, , options]) => typeof options?.visible === 'function')).toBe(true);
});

test('detect runs root listing and version history reads in parallel after marker check fails', async () => {
    let resolveList!: (value: { name: string; size: number; isFile: boolean; modifiedAt: string }[]) => void;
    let resolveHistory!: (value: string | null) => void;
    const calls: string[] = [];

    const api = {
        readOrNull: vi.fn((file: string) => {
            calls.push(`read:${file}`);
            if (file === '/version_history.json') {
                return new Promise<string | null>((resolve) => {
                    resolveHistory = resolve;
                });
            }
            return Promise.resolve(null);
        }),
        listOrEmpty: vi.fn((dir: string) => {
            calls.push(`list:${dir}`);
            return new Promise<{ name: string; size: number; isFile: boolean; modifiedAt: string }[]>((resolve) => {
                resolveList = resolve;
            });
        }),
    } as unknown as ServerApi;

    const pending = detect(api);
    await new Promise((r) => setTimeout(r, 0));

    expect(calls).toEqual(['read:/.obsidian-software.json', 'list:/', 'read:/version_history.json']);

    resolveList([{ name: 'purpur.yml', size: 0, isFile: true, modifiedAt: '' }]);
    resolveHistory(JSON.stringify({ currentVersion: 'git-Purpur-2300 (MC: 1.21.4)' }));

    await expect(pending).resolves.toEqual({ software: 'purpur', version: '1.21.4' });
});
