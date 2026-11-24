import { Document, isMap, isScalar, isSeq, parseDocument, type Node } from 'yaml';

export type Value = string | number | boolean | null;

export interface Leaf {
    readonly path: (string | number)[];
    readonly key: string;
    readonly section: string;
    readonly value: Value;
    readonly comment: string;
}

export const parseYaml = (text: string): Document => parseDocument(text, { keepSourceTokens: true });

export function leaves(doc: Document): Leaf[] {
    const out: Leaf[] = [];
    const walk = (node: Node | null | undefined, path: (string | number)[]) => {
        if (!isMap(node)) return;
        for (const pair of node.items) {
            const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
            const at = [...path, key];
            if (isMap(pair.value)) walk(pair.value, at);
            else if (
                isScalar(pair.value) &&
                (pair.value.value === null || ['string', 'number', 'boolean'].includes(typeof pair.value.value))
            ) {
                out.push({
                    path: at,
                    key,
                    section: path.length ? path.join(' › ') : 'General',
                    value: pair.value.value as Value,
                    comment: (pair.value.comment || (isScalar(pair.key) ? pair.key.commentBefore : '') || '').trim(),
                });
            } else if (isSeq(pair.value)) {
            }
        }
    };
    walk(doc.contents, []);
    return out;
}

export const pathKey = (path: readonly (string | number)[]) => path.join('\u0000');

export function applyChanges(
    text: string,
    changes: ReadonlyMap<string, { path: (string | number)[]; value: Value }>
): string {
    const doc = parseYaml(text);
    for (const { path, value } of changes.values()) doc.setIn(path, value);
    return doc.toString({ lineWidth: 0 });
}

export function coerce(original: Value, typed: string): Value {
    if (typeof original === 'number') {
        const n = Number(typed);
        return typed.trim() === '' || Number.isNaN(n) ? original : n;
    }
    return typed;
}
