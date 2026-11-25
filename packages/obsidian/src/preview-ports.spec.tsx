import { afterEach, beforeAll, test, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    createExtensionTestHost,
    createTestServer,
    preloadTheme,
    renderWithTheme,
    type ExtensionTestHost,
    type RenderedView,
} from '@pterodactyl/sdk/testing';
import theme from './theme';

const out = process.env.PREVIEW;
const allocationData = vi.hoisted(() => [
    {
        id: 18,
        ip: '127.0.0.1',
        alias: 'node.example.test',
        port: 19132,
        notes: 'Geyser Bedrock',
        primary: false,
    },
    {
        id: 17,
        ip: '127.0.0.1',
        alias: 'node.example.test',
        port: 25565,
        notes: 'Minecraft Java',
        primary: true,
    },
]);

vi.mock('./ops/allocations', () => ({
    listAllocations: async () => allocationData,
}));

let host: ExtensionTestHost | undefined;
let rendered: RenderedView | undefined;

beforeAll(async () => {
    if (!out) return;
    await preloadTheme([theme]);
    mkdirSync(out, { recursive: true });
    cpSync(join(__dirname, '../dist'), join(out, 'dist'), { recursive: true });
});

afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    host?.dispose();
    host = undefined;
});

const page = (body: string, scheme: string) => `<!doctype html>
<html class="${scheme}" data-obs-decor="true" data-obs-surface="graphite">
<head><meta charset="utf-8"><link rel="stylesheet" href="dist/theme.css">
<style>body{margin:0;padding:24px} .obs-pop,.obs-stagger>*{animation:none!important}</style></head>
<body><main>${body}</main></body></html>`;

test.skipIf(!out)('preview the ports screen in dark and light themes at mobile width', async () => {
    const server = createTestServer({
        eggFeatures: ['eula', 'java_version'],
        eggTags: ['minecraft'],
        permissions: ['allocation.read', 'allocation.create', 'allocation.update', 'allocation.delete'],
    });
    host = createExtensionTestHost({ server, path: `/server/${server.attributes.identifier}/mc/ports` });
    const { default: PortsScreen } = await import('./tools/screens/PortsScreen');
    rendered = renderWithTheme(
        <host.Wrapper>
            <PortsScreen />
        </host.Wrapper>,
        { themes: [theme] }
    );
    await screen.findByText('Geyser Bedrock');
    const html = rendered.container.innerHTML;
    for (const scheme of ['dark', 'light']) writeFileSync(join(out!, `ports-${scheme}.html`), page(html, scheme));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
});
