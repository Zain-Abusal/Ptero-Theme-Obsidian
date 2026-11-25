import { afterEach, beforeAll, test } from 'vitest';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from '@testing-library/react';
import type { ComponentType } from 'react';
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
    'Flags',
    'Properties',
    'Players',
    'Packs',
    'Worlds',
    'Scheduler',
    'Doctor',
    'Votifier',
    'Importer',
];

for (const name of SCREENS) {
    test.skipIf(!out)(`preview ${name}`, async () => {
        const server = createTestServer({ eggFeatures: ['eula', 'java_version'], eggTags: ['minecraft'] });
        host = createExtensionTestHost({
            server,
            path: `/server/${server.attributes.identifier}/mc/${name.toLowerCase()}`,
        });
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
