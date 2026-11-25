import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, serverStartupQueryOptions, type SdkServerStartup } from '@pterodactyl/sdk';
import {
    createExtensionTestHost,
    createTestServer,
    preloadTheme,
    renderWithTheme,
    type ExtensionTestHost,
    type RenderedView,
} from '@pterodactyl/sdk/testing';
import theme from '../theme';
import FlagsScreen from './screens/FlagsScreen';
import {
    FLAG_PRESETS,
    detectPreset,
    findFlagsVariable,
    findReadOnlyFlagsVariable,
    formatMemory,
    headroomMemoryMb,
    parseJavaMajor,
    presetById,
    previewStartupCommand,
    startupHasMemoryFlags,
    stripMemoryFlags,
} from './lib/flags';

const startupFixture = (
    variables: {
        env_variable: string;
        name?: string;
        default_value?: string;
        server_value?: string | null;
        is_editable?: boolean;
    }[],
    rawStartup = 'java -Xms128M -Xmx{{SERVER_MEMORY}}M {{STARTUP_FLAGS}} -jar {{SERVER_JARFILE}}'
): SdkServerStartup => ({
    object: 'list',
    data: variables.map((v) => ({
        object: 'egg_variable',
        attributes: {
            name: v.name ?? v.env_variable,
            description: '',
            env_variable: v.env_variable,
            default_value: v.default_value ?? '',
            server_value: v.server_value === undefined ? null : v.server_value,
            is_editable: v.is_editable ?? true,
            rules: 'nullable|string',
        },
    })),
    meta: {
        startup_command: rawStartup,
        raw_startup_command: rawStartup,
        docker_images: { 'Java 21': 'ghcr.io/pterodactyl/yolks:java_21' },
    },
});

let host: ExtensionTestHost | undefined;
let rendered: RenderedView | undefined;

beforeAll(() => preloadTheme([theme]));

afterEach(() => {
    rendered?.unmount();
    host?.dispose();
    vi.restoreAllMocks();
});

test('generates standard Aikar flags up to 12GB and tuned flags above 12GB', () => {
    const aikar = presetById('aikar');
    const at4g = aikar.generate(4096);
    const at12g = aikar.generate(12288);
    const at16g = aikar.generate(16384);

    expect(at4g).toBe(
        '-Xms4096M -Xmx4096M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1'
    );
    expect(at12g).toContain('-XX:G1NewSizePercent=30');
    expect(at12g).toContain('-XX:G1MaxNewSizePercent=40');
    expect(at12g).toContain('-XX:InitiatingHeapOccupancyPercent=15');

    expect(at16g).toContain('-Xms16384M -Xmx16384M');
    expect(at16g).toContain('-XX:G1NewSizePercent=40');
    expect(at16g).toContain('-XX:G1MaxNewSizePercent=50');
    expect(at16g).toContain('-XX:InitiatingHeapOccupancyPercent=20');
});

test('generates ZGC, Shenandoah and Basic presets with safe memory defaults', () => {
    expect(FLAG_PRESETS.map((p) => p.id)).toEqual(['aikar', 'zgc', 'shenandoah', 'vanilla']);

    const zgc = presetById('zgc');
    expect(zgc.java).toBe('Java 21+');
    expect(zgc.generate(8192)).toContain('-Xms8192M -Xmx8192M -XX:+UseZGC -XX:+ZGenerational');

    const shenandoah = presetById('shenandoah');
    expect(shenandoah.generate(6144)).toContain('-Xms6144M -Xmx6144M');
    expect(shenandoah.generate(6144)).toContain('-XX:+UseShenandoahGC');

    const vanilla = presetById('vanilla');
    expect(vanilla.generate(2048)).toBe('-Xms2048M -Xmx2048M');
    expect(vanilla.generate(0)).toBe('-Xms4096M -Xmx4096M');
});

test('detects editable flags variables while ignoring non-flag and read-only variables', () => {
    const standard = startupFixture([
        { env_variable: 'SERVER_JARFILE', default_value: 'server.jar' },
        { env_variable: 'JAVA_VERSION', default_value: '21' },
        { env_variable: 'ADDITIONAL_FLAGS', default_value: '-XX:+UseG1GC' },
        { env_variable: 'STARTUP_FLAGS', server_value: '', default_value: 'ignored' },
    ]);
    expect(findFlagsVariable(standard)).toEqual({
        key: 'STARTUP_FLAGS',
        name: 'STARTUP_FLAGS',
        value: '',
        editable: true,
    });

    const fallback = startupFixture([
        { env_variable: 'MINECRAFT_VERSION', default_value: '1.21.4' },
        { env_variable: 'USER_JVM_ARGS', server_value: '-XX:+UseZGC' },
    ]);
    expect(findFlagsVariable(fallback)?.key).toBe('USER_JVM_ARGS');

    const readOnlyOnly = startupFixture([
        { env_variable: 'STARTUP_FLAGS', default_value: '-XX:+UseG1GC', is_editable: false },
    ]);
    expect(findFlagsVariable(readOnlyOnly)).toBeNull();
    expect(findReadOnlyFlagsVariable(readOnlyOnly)?.key).toBe('STARTUP_FLAGS');
});

test('supports memory helpers, preset detection, java image parsing and startup command preview', () => {
    expect(stripMemoryFlags('-Xms4096M -Xmx4096M -XX:+UseG1GC')).toBe('-XX:+UseG1GC');
    expect(headroomMemoryMb(4096)).toBe(3482);
    expect(formatMemory(4096)).toBe('4 GB');
    expect(formatMemory(1536)).toBe('1.5 GB');
    expect(formatMemory(0)).toBe('Unlimited');
    expect(parseJavaMajor('ghcr.io/pterodactyl/yolks:java_21')).toBe(21);
    expect(parseJavaMajor('ghcr.io/pterodactyl/yolks:java_17')).toBe(17);

    expect(detectPreset(presetById('aikar').generate(4096))).toBe('aikar');
    expect(detectPreset(presetById('zgc').generate(4096))).toBe('zgc');
    expect(detectPreset(presetById('shenandoah').generate(4096))).toBe('shenandoah');
    expect(detectPreset('-Xms2048M -Xmx2048M')).toBe('vanilla');
    expect(detectPreset('-Dcustom=1')).toBeNull();

    const startup = startupFixture([
        { env_variable: 'SERVER_JARFILE', default_value: 'paper.jar' },
        { env_variable: 'STARTUP_FLAGS', default_value: '' },
    ]);
    expect(startupHasMemoryFlags(startup, 'STARTUP_FLAGS')).toBe(true);
    expect(previewStartupCommand(startup, 'STARTUP_FLAGS', '-XX:+UseZGC', 4096)).toBe(
        'java -Xms128M -Xmx4096M -XX:+UseZGC -jar paper.jar'
    );
});

test('renders FlagsScreen and applies selected preset to detected editable variable', async () => {
    const server = createTestServer({
        permissions: ['startup.read', 'startup.update'],
        eggFeatures: ['eula', 'java_version'],
        eggTags: ['minecraft'],
    });
    server.attributes.limits.memory = 4096;
    server.attributes.docker_image = 'ghcr.io/pterodactyl/yolks:java_21';

    let currentStartup = startupFixture([{ env_variable: 'JVM_FLAGS', server_value: '-Xms1G -Xmx1G' }]);

    vi.spyOn(http, 'get').mockImplementation((url) => {
        if (url.endsWith('/startup')) return Promise.resolve({ data: currentStartup } as never);
        if (url.endsWith('/files/list')) return Promise.resolve({ data: { data: [] } } as never);
        return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    const putSpy = vi.spyOn(http, 'put').mockImplementation((_url, body) => {
        const payload = body as { key: string; value: string };
        currentStartup = startupFixture([{ env_variable: payload.key, server_value: payload.value }]);
        return Promise.resolve({ data: {} } as never);
    });

    host = createExtensionTestHost({
        server,
        path: `/server/${server.attributes.identifier}/mc/flags`,
    });
    host.queryClient.setQueryData(serverStartupQueryOptions(server.attributes.identifier).queryKey, currentStartup);

    rendered = renderWithTheme(
        <host.Wrapper>
            <FlagsScreen />
        </host.Wrapper>,
        { themes: [theme] }
    );

    expect(await screen.findByText('4 GB')).not.toBeNull();
    expect(screen.getByText('-Xms1G -Xmx1G')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Generational ZGC/ }));
    const preview = screen.getByRole('textbox', { name: 'Generated JVM flags' }) as HTMLTextAreaElement;
    expect(preview.value).toBe(presetById('zgc').generate(4096));

    fireEvent.click(screen.getByRole('button', { name: 'Apply to JVM_FLAGS' }));
    await waitFor(() =>
        expect(putSpy).toHaveBeenCalledWith(`/api/client/servers/${server.attributes.identifier}/startup/variable`, {
            key: 'JVM_FLAGS',
            value: presetById('zgc').generate(4096),
        })
    );
});

test('shows copyable fallback and admin note when no editable flags variable exists', async () => {
    const server = createTestServer({
        permissions: ['startup.read', 'startup.update'],
        eggFeatures: ['eula', 'java_version'],
        eggTags: ['minecraft'],
    });
    server.attributes.limits.memory = 8192;

    const currentStartup = startupFixture([
        { env_variable: 'SERVER_JARFILE', default_value: 'server.jar', is_editable: true },
    ]);

    vi.spyOn(http, 'get').mockImplementation((url) => {
        if (url.endsWith('/startup')) return Promise.resolve({ data: currentStartup } as never);
        if (url.endsWith('/files/list')) return Promise.resolve({ data: { data: [] } } as never);
        return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    host = createExtensionTestHost({
        server,
        path: `/server/${server.attributes.identifier}/mc/flags`,
    });
    host.queryClient.setQueryData(serverStartupQueryOptions(server.attributes.identifier).queryKey, currentStartup);

    rendered = renderWithTheme(
        <host.Wrapper>
            <FlagsScreen />
        </host.Wrapper>,
        { themes: [theme] }
    );

    expect(await screen.findByText(/No editable JVM flags variable was found on this egg/)).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Copy flags' })).not.toBeNull();
});

test('toggles headroom and memory switches and flags read-only variables', async () => {
    const server = createTestServer({
        permissions: ['startup.read', 'startup.update'],
        eggFeatures: ['eula', 'java_version'],
        eggTags: ['minecraft'],
    });
    server.attributes.limits.memory = 4096;

    const currentStartup = startupFixture([{ env_variable: 'STARTUP_FLAGS', default_value: '', is_editable: false }]);

    vi.spyOn(http, 'get').mockImplementation((url) => {
        if (url.endsWith('/startup')) return Promise.resolve({ data: currentStartup } as never);
        if (url.endsWith('/files/list')) return Promise.resolve({ data: { data: [] } } as never);
        return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    host = createExtensionTestHost({
        server,
        path: `/server/${server.attributes.identifier}/mc/flags`,
    });
    host.queryClient.setQueryData(serverStartupQueryOptions(server.attributes.identifier).queryKey, currentStartup);

    rendered = renderWithTheme(
        <host.Wrapper>
            <FlagsScreen />
        </host.Wrapper>,
        { themes: [theme] }
    );

    expect(await screen.findByText(/is read-only on this egg/)).not.toBeNull();

    const preview = screen.getByRole('textbox', { name: 'Generated JVM flags' }) as HTMLTextAreaElement;
    expect(preview.value).toContain('-Xms4096M -Xmx4096M');

    fireEvent.click(screen.getByRole('switch', { name: /Reserve container headroom/ }));
    expect(preview.value).toContain('-Xms3482M -Xmx3482M');

    fireEvent.click(screen.getByRole('switch', { name: /Include -Xms and -Xmx/ }));
    expect(preview.value).not.toContain('-Xms');
    expect(preview.value).not.toContain('-Xmx');
    expect(preview.value).toContain('-XX:+UseG1GC');
});
