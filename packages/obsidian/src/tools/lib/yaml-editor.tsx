import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, FileCode2, RotateCcw, Save } from 'lucide-react';
import { Alert, Button, PanelLink, Spinner, Switch, cn, toast } from '@pterodactyl/sdk';
import { attempt } from '../ui/Page';
import { useToolkit } from './useToolkit';
import { applyChanges, coerce, leaves, parseYaml, pathKey, type Leaf, type Value } from './yaml-config';
import Collapse from '../../ui/Collapse';

function Control({ leaf, value, onChange }: { leaf: Leaf; value: Value; onChange: (value: Value) => void }) {
    const input =
        'h-9 w-full rounded-lg border border-input-border bg-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring';

    if (typeof leaf.value === 'boolean')
        return <Switch checked={value === true} onChange={() => onChange(!(value === true))} aria-label={leaf.key} />;
    if (typeof leaf.value === 'number') {
        return (
            <input
                type='number'
                value={String(value ?? '')}
                onChange={(e) => onChange(coerce(leaf.value, e.target.value))}
                aria-label={leaf.key}
                className={cn(input, 'font-mono md:w-40')}
            />
        );
    }
    return (
        <input
            value={value === null ? '' : String(value)}
            onChange={(e) => onChange(e.target.value)}
            aria-label={leaf.key}
            className={input}
        />
    );
}

export default function YamlEditor({ file, term, changesOnly }: { file: string; term: string; changesOnly: boolean }) {
    const { id, api } = useToolkit();
    const client = useQueryClient();
    const key = ['obsidian-mc', id, 'yaml', file];
    const source = useQuery({ queryKey: key, queryFn: () => api.readOrNull(file) });
    const [edits, setEdits] = useState<Map<string, { path: (string | number)[]; value: Value }>>(new Map());
    const [open, setOpen] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => setEdits(new Map()), [file, source.data]);

    const parsed = useMemo(() => {
        if (source.data == null) return null;
        const doc = parseYaml(source.data);
        return { leaves: leaves(doc), errors: doc.errors.length };
    }, [source.data]);

    const sections = useMemo(() => {
        const needle = term.trim().toLowerCase();
        const groups = new Map<string, Leaf[]>();
        for (const leaf of parsed?.leaves ?? []) {
            const k = pathKey(leaf.path);
            if (changesOnly && !edits.has(k)) continue;
            if (needle && ![leaf.path.join('.'), leaf.comment].some((s) => s.toLowerCase().includes(needle))) continue;
            groups.set(leaf.section, [...(groups.get(leaf.section) ?? []), leaf]);
        }
        return [...groups.entries()];
    }, [parsed, term, changesOnly, edits]);

    const set = (leaf: Leaf) => (value: Value) => {
        const next = new Map(edits);
        if (value === leaf.value) next.delete(pathKey(leaf.path));
        else next.set(pathKey(leaf.path), { path: leaf.path, value });
        setEdits(next);
    };

    const save = async () => {
        if (source.data == null) return;
        setSaving(true);
        await attempt(
            () => api.write(file, applyChanges(source.data!, edits)),
            'Saved. Restart the server to apply.',
            toast
        );
        await client.invalidateQueries({ queryKey: key });
        setSaving(false);
    };

    const editorLink = (
        <PanelLink
            destination={{ to: '/server/$id/files/$action', params: { id, action: 'edit' }, hash: file }}
            className='inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground no-underline hover:text-foreground'
        >
            <FileCode2 className='size-3.5' aria-hidden /> Open {file.split('/').pop()} in the file editor
        </PanelLink>
    );

    if (source.isLoading) return <Spinner size='large' centered />;
    if (source.data == null) {
        return (
            <Alert type='info'>
                {file} does not exist on this server. It is written by servers that use it the first time they start.
            </Alert>
        );
    }

    return (
        <div className='flex flex-col gap-4'>
            <div className='flex flex-wrap items-center gap-3'>
                {editorLink}
                <span className='text-xs text-muted-foreground'>Lists are edited in the file editor.</span>
                <div className='ml-auto flex gap-2'>
                    <Button color='grey' disabled={edits.size === 0 || saving} onClick={() => setEdits(new Map())}>
                        <RotateCcw className='size-4' aria-hidden /> Undo{edits.size > 0 && ` ${edits.size}`}
                    </Button>
                    <Button disabled={edits.size === 0} isLoading={saving} onClick={save}>
                        <Save className='size-4' aria-hidden /> Save
                    </Button>
                </div>
            </div>
            {parsed && parsed.errors > 0 && (
                <Alert type='warning'>
                    This file has YAML errors, so saving is risky. Fix it in the file editor first.
                </Alert>
            )}
            {sections.length === 0 && (
                <p className='py-6 text-center text-sm text-muted-foreground'>No settings match.</p>
            )}
            <div className='flex flex-col gap-2.5'>
                {sections.map(([name, list], index) => {
                    const expanded =
                        term !== '' || changesOnly || open.includes(name) || (open.length === 0 && index === 0);
                    return (
                        <section key={name} className='rounded-xl border border-border bg-card'>
                            <button
                                type='button'
                                aria-expanded={expanded}
                                onClick={() =>
                                    setOpen(expanded ? open.filter((g) => g !== name) : [...open.filter(Boolean), name])
                                }
                                className='flex w-full items-center gap-3 px-5 py-4 text-left'
                            >
                                <span className='min-w-0 truncate font-bold capitalize'>{name.replace(/-/g, ' ')}</span>
                                <span className='shrink-0 text-xs text-muted-foreground'>{list.length} settings</span>
                                <ChevronDown
                                    className={cn(
                                        'ml-auto size-4 shrink-0 text-muted-foreground transition',
                                        expanded && 'rotate-180'
                                    )}
                                    aria-hidden
                                />
                            </button>
                            <Collapse open={expanded}>
                                <ul className='divide-y divide-border border-t border-border'>
                                    {list.map((leaf) => {
                                        const k = pathKey(leaf.path);
                                        const value = edits.has(k) ? edits.get(k)!.value : leaf.value;
                                        return (
                                            <li
                                                key={k}
                                                className='grid items-center gap-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]'
                                            >
                                                <div className='min-w-0'>
                                                    <p className='flex items-center gap-2 text-sm font-semibold'>
                                                        <span className='truncate capitalize'>
                                                            {leaf.key.replace(/[-_]/g, ' ')}
                                                        </span>
                                                        {edits.has(k) && (
                                                            <span
                                                                className='size-1.5 shrink-0 rounded-full bg-warning'
                                                                aria-label='changed'
                                                            />
                                                        )}
                                                    </p>
                                                    <p className='truncate text-xs text-muted-foreground'>
                                                        {leaf.comment && `${leaf.comment.replace(/^#\s*/gm, '')} `}
                                                        <code className='font-mono opacity-70'>
                                                            {leaf.path.join('.')}
                                                        </code>
                                                    </p>
                                                </div>
                                                <div className='flex md:justify-end'>
                                                    <Control leaf={leaf} value={value} onChange={set(leaf)} />
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Collapse>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
