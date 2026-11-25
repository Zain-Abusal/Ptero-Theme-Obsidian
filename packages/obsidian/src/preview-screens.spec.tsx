import { afterEach, beforeAll, test, vi } from 'vitest';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from '@testing-library/react';
import type { ComponentType } from 'react';
import { http, serverStartupQueryOptions } from '@pterodactyl/sdk';
import {
    createExtensionTestHost,
    createTestServer,
    preloadTheme,
    renderWithTheme,
    type ExtensionTestHost,
} from '@pterodactyl/sdk/testing';
import theme from './theme';

const out = process.env.PREVIEW;
let host: ExtensionTestHost | undefined;
let unmount: (() => void) | undefined;

beforeAll(async () => {
    if (!out) return;
    await preloadTheme([theme]);
    mkdirSync(out, { recursive: true });
    cpSync(join(__dirname, '../dist'), join(out, 'dist'), { recursive: true });
});
afterEach(() => {
    unmount?.();
    host?.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const page = (body: string, scheme: string) => `<!doctype html>
<html class="${scheme}" data-obs-decor="true" data-obs-surface="graphite">
<head><meta charset="utf-8"><link rel="stylesheet" href="dist/theme.css">
<style>body{margin:0;padding:24px} .obs-pop,.obs-stagger>*{animation:none!important}</style></head>
<body><main>${body}</main></body></html>`;

const SCREENS = [
    'Plugins',
    'Kits',
    'Versions',
    'Properties',
    'Players',
    'Packs',
    'Worlds',
    'Scheduler',
    'Doctor',
    'Votifier',
    'Importer',
    'Flags',
];

for (const name of SCREENS) {
    test.skipIf(!out)(`preview ${name}`, async () => {
        if (name === 'Versions') {
            vi.spyOn(http, 'get').mockImplementation((url) => {
                if (url.endsWith('/startup'))
                    return Promise.resolve({
                        data: {
                            data: [
                                {
                                    object: 'egg_variable',
                                    attributes: {
                                        env_variable: 'SERVER_JARFILE',
                                        server_value: 'server.jar',
                                        default_value: 'server.jar',
                                        name: 'Server Jar File',
                                        description: '',
                                        is_editable: true,
                                        rules: 'required|string',
                                    },
                                },
                            ],
                            meta: {
                                startup_command: 'java -jar server.jar',
                                raw_startup_command: 'java -jar server.jar',
                            },
                        },
                    } as never);
                if (url.endsWith('/files/list')) return Promise.resolve({ data: { data: [] } } as never);
                if (url.endsWith('/resources'))
                    return Promise.resolve({ data: { attributes: { current_state: 'offline' } } } as never);
                return Promise.reject(new Error('Preview request'));
            });
            vi.stubGlobal(
                'fetch',
                vi.fn().mockResolvedValue({
                    ok: true,
                    json: async () => ({
                        versions: { '1.21': ['1.21.4', '1.21.3'], '1.20': ['1.20.6', '1.20.4'] },
                    }),
                })
            );
        }
        const server = createTestServer({ eggFeatures: ['eula', 'java_version'], eggTags: ['minecraft'] });
        if (name === 'Flags') {
            server.attributes.limits.memory = 4096;
            server.attributes.docker_image = 'ghcr.io/pterodactyl/yolks:java_21';
            vi.spyOn(http, 'get').mockImplementation((url) => {
                if (url.endsWith('/startup'))
                    return Promise.resolve({
                        data: {
                            data: [
                                {
                                    object: 'egg_variable',
                                    attributes: {
                                        env_variable: 'JVM_FLAGS',
                                        server_value: '-Xms1G -Xmx1G',
                                        default_value: '',
                                        name: 'JVM Flags',
                                        description: 'Additional Java flags.',
                                        is_editable: true,
                                        rules: 'nullable|string',
                                    },
                                },
                            ],
                            meta: {
                                startup_command: 'java {{JVM_FLAGS}} -jar server.jar',
                                raw_startup_command: 'java {{JVM_FLAGS}} -jar server.jar',
                                docker_images: { 'Java 21': 'ghcr.io/pterodactyl/yolks:java_21' },
                            },
                        },
                    } as never);
                return Promise.reject(new Error('Preview request'));
            });
        }
        host = createExtensionTestHost({
            server,
            path: `/server/${server.attributes.identifier}/mc/${name.toLowerCase()}`,
        });
        if (name === 'Flags')
            host.queryClient.setQueryData(serverStartupQueryOptions(server.attributes.identifier).queryKey, {
                data: [
                    {
                        object: 'egg_variable',
                        attributes: {
                            env_variable: 'JVM_FLAGS',
                            server_value: '-Xms1G -Xmx1G',
                            default_value: '',
                            name: 'JVM Flags',
                            description: 'Additional Java flags.',
                            is_editable: true,
                            rules: 'nullable|string',
                        },
                    },
                ],
                meta: {
                    startup_command: 'java {{JVM_FLAGS}} -jar server.jar',
                    raw_startup_command: 'java {{JVM_FLAGS}} -jar server.jar',
                },
            } as never);
        const Screen = ((await import(`./tools/screens/${name}Screen.tsx`)) as { default: ComponentType }).default;
        const rendered = renderWithTheme(
            <host.Wrapper>
                <Screen />
            </host.Wrapper>,
            { themes: [theme] }
        );
        const container = rendered.container;
        unmount = () => rendered.unmount();
        await act(() => new Promise((r) => setTimeout(r, 400)));
        for (const scheme of ['dark', 'light'])
            writeFileSync(join(out!, `screen-${name}-${scheme}.html`), page(container.innerHTML, scheme));
    });
}
