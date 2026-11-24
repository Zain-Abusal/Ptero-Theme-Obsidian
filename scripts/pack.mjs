#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'release');
const FOLDERS = ['routes', 'database', 'resources', 'dist', 'vendor'];
const SKIP = new Set(['node_modules', 'tests', 'test', 'coverage']);

function files(dir, base) {
    return readdirSync(dir).flatMap((name) => {
        if (name.startsWith('.') || SKIP.has(name)) return [];
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return files(path, base);
        return name.endsWith('.map') ? [] : [relative(base, path)];
    });
}

mkdirSync(out, { recursive: true });
let failed = false;

for (const name of readdirSync(join(root, 'packages'))) {
    const dir = join(root, 'packages', name);
    const manifestPath = join(dir, 'extension.json');
    if (!existsSync(manifestPath)) continue;

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const problems = [];
    if (manifest.ui?.entry && !existsSync(join(dir, manifest.ui.entry)))
        problems.push(`missing ${manifest.ui.entry}; run npm run build`);
    if (manifest.theme?.stylesheet && !existsSync(join(dir, manifest.theme.stylesheet)))
        problems.push(`missing ${manifest.theme.stylesheet}`);
    if (manifest.type === 'theme' && !existsSync(join(dir, 'dist/theme.json')))
        problems.push('missing dist/theme.json');
    if (problems.length) {
        console.error(`✗ ${manifest.id}: ${problems.join(', ')}`);
        failed = true;
        continue;
    }

    const list = ['extension.json'];
    if (existsSync(join(dir, 'composer.json'))) list.push('composer.json');
    for (const folder of FOLDERS) if (existsSync(join(dir, folder))) list.push(...files(join(dir, folder), dir));
    if (typeof manifest.icon === 'string' && /\.(png|jpe?g|webp)$/i.test(manifest.icon)) list.push(manifest.icon);

    const folder = join(out, manifest.type === 'theme' ? 'themes' : 'extensions');
    mkdirSync(folder, { recursive: true });
    const archive = join(folder, `${manifest.id}-${manifest.version}.pteroext`);
    rmSync(archive, { force: true });

    execFileSync('zip', ['-q', '-X', archive, ...list], { cwd: dir });
    const size = (statSync(archive).size / 1024).toFixed(0);
    console.log(
        `✓ ${manifest.id} ${manifest.version} → ${relative(root, archive)} (${list.length} files, ${size} KiB)`
    );
}

process.exit(failed ? 1 : 0);
