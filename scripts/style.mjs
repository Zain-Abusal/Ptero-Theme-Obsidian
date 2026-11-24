#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';

const ts = createRequire(import.meta.url)('typescript');
const root = resolve(import.meta.dirname, '..');
const fix = process.argv.includes('--fix');
const DASH_CHARS = String.fromCharCode(0x2013, 0x2014);
const DASHES = new RegExp(`[${DASH_CHARS}]`);
const ROOTS = ['packages', 'scripts', '.github', 'README.md'];
const CODE = /\.(ts|tsx|mjs|css)$/;
const TEXT = /\.(ts|tsx|mjs|css|md|json|yml)$/;

function walk(path) {
    if (/node_modules|\/dist|\/fonts/.test(path)) return [];
    if (statSync(path).isDirectory()) return readdirSync(path).flatMap((name) => walk(join(path, name)));
    return TEXT.test(path) ? [path] : [];
}

function stripComments(file, text) {
    if (file.endsWith('.css')) return text.replace(/\/\*[\s\S]*?\*\//g, '');
    const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
    const cuts = new Map();
    const add = (list) => list?.forEach((r) => cuts.set(r.pos, r.end));
    const visit = (node) => {
        if (ts.isJsxText(node)) return;
        if (ts.isJsxExpression(node) && !node.expression) {
            cuts.set(node.getStart(source), node.end);
            return;
        }
        add(ts.getLeadingCommentRanges(text, node.pos));
        add(ts.getTrailingCommentRanges(text, node.end));
        ts.forEachChild(node, visit);
    };
    visit(source);
    add(ts.getLeadingCommentRanges(text, source.endOfFileToken.pos));
    let out = text;
    let last = Infinity;
    for (const [start, end] of [...cuts.entries()].sort((a, b) => b[0] - a[0])) {
        if (end > last) continue;
        out = out.slice(0, start) + out.slice(end);
        last = start;
    }
    return out
        .split('\n')
        .filter((line, i, lines) => !/^\s*\/\/ /.test(line) || lines[i].includes('`'))
        .map((line) => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\{\n\n/g, '{\n');
}

const problems = [];
for (const file of ROOTS.map((r) => join(root, r)).flatMap(walk)) {
    const text = readFileSync(file, 'utf8');
    let next = text;
    if (CODE.test(file)) next = stripComments(file, next);
    if (DASHES.test(next)) {
        if (fix) next = next.replace(new RegExp(`\\s*[${DASH_CHARS}]\\s*`, 'g'), ', ');
        else problems.push(`${relative(root, file)}: contains an em or en dash`);
    }
    if (next !== text) {
        if (fix) writeFileSync(file, next);
        else if (CODE.test(file) && stripComments(file, text) !== text)
            problems.push(`${relative(root, file)}: contains comments`);
    }
}

if (problems.length) {
    console.error(problems.join('\n'));
    console.error('\nRun `npm run style:fix` to clean these up.');
    process.exit(1);
}
console.log(fix ? 'Style fixed.' : 'Style OK: no comments, no em or en dashes.');
