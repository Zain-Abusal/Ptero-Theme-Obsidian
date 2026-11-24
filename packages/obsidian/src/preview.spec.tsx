import { afterEach, beforeAll, test } from 'vitest';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    createExtensionTestHost,
    preloadTheme,
    renderView,
    type ExtensionTestHost,
    type RenderedView,
} from '@pterodactyl/sdk/testing';
import theme from './theme';

const out = process.env.PREVIEW;
const themes = [theme];
let rendered: RenderedView | undefined;
let host: ExtensionTestHost | undefined;

beforeAll(async () => {
    if (!out) return;
    await preloadTheme(themes);
    mkdirSync(out, { recursive: true });
    cpSync(join(__dirname, '../dist'), join(out, 'dist'), { recursive: true });
});
afterEach(() => {
    rendered?.unmount();
    host?.dispose();
});

const page = (body: string, scheme: string, surface: string) => `<!doctype html>
<html class="${scheme}" data-obs-decor="true" data-obs-surface="${surface}" data-sub-navigation="side">
<head><meta charset="utf-8"><link rel="stylesheet" href="dist/theme.css">
<style>body{margin:0} .obs-pop,.obs-stagger>*{animation:none!important}</style></head>
<body>${body}</body></html>`;

const VIEWS: [string, string, string | undefined, boolean][] = [
    ['shell-dashboard', 'layout.app', 'admin', false],
    ['shell-server', 'layout.app', 'serverArea', false],
    ['dashboard', 'dashboard.serverList', 'servers', true],
    ['account', 'page.account.overview', undefined, true],
    ['login', 'page.auth.login', 'default', false],
    ['stats', 'server.stats', undefined, false],
    ['search', 'app.search', 'results', false],
];

for (const [file, view, fixture, needsUser] of VIEWS) {
    test.skipIf(!out)(`preview ${file}`, () => {
        if (needsUser) host = createExtensionTestHost();
        rendered = renderView(view as never, { themes, fixture } as never);
        const html = rendered.container.innerHTML;
        if (!html) throw new Error(`${view} rendered nothing`);
        for (const [scheme, surface] of [
            ['dark', 'graphite'],
            ['light', 'graphite'],
            ['dark', 'midnight'],
        ]) {
            writeFileSync(join(out!, `${file}-${scheme}-${surface}.html`), page(html, scheme, surface));
        }
    });
}
