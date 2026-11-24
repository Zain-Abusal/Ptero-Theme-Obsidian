import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImageUp, RotateCcw } from 'lucide-react';
import { Button, Dialog, cn, http, httpErrorToHuman, toast, type SdkServer } from '@pterodactyl/sdk';
import { can } from '../lib/servers';
import { GLYPHS, GLYPH_NAMES } from '../lib/glyphs';
import ServerIcon, { TemplateIcon, iconQueryKey } from '../lib/serverIcon';
import Collapse from '../ui/Collapse';
import { TINTS, defaultTint, useSaveServerMeta, useServerMeta, type ServerMeta } from '../lib/serverMeta';
import { toServerIcon, uploadFiles } from '../lib/upload';

const label = 'mb-1.5 block text-xs font-semibold text-muted-foreground';
const field =
    'h-10 w-full rounded-lg border border-input-border bg-input px-3 text-sm outline-none focus:ring-2 focus:ring-ring';

export default function CustomizeServer({ server, onClose }: { server: SdkServer; onClose: () => void }) {
    const { identifier, uuid } = server.attributes;
    const current = useServerMeta(identifier);
    const save = useSaveServerMeta(identifier);
    const client = useQueryClient();
    const canRename = can(server, 'settings.rename');
    const file = useRef<HTMLInputElement>(null);
    const [name, setName] = useState(server.attributes.name);
    const [group, setGroup] = useState(current.group ?? '');
    const [color, setColor] = useState(current.color ?? '');
    const [glyph, setGlyph] = useState<string | null>(current.icon?.glyph ?? null);
    const [note, setNote] = useState(current.note ?? '');
    const [busy, setBusy] = useState(false);
    const [moreIcons, setMoreIcons] = useState(false);
    const tint = color || defaultTint(uuid);

    const suggestions = useMemo(
        () =>
            [
                ...new Set(
                    client
                        .getQueriesData<ServerMeta>({ queryKey: ['obsidian', 'meta'] })
                        .map(([, meta]) => meta?.group)
                        .filter((g): g is string => !!g)
                ),
            ].sort(),
        [client]
    );

    const glyphButton = (g: string) => {
        const Glyph = GLYPHS[g];
        return (
            <button
                key={g}
                type='button'
                aria-label={g}
                aria-pressed={glyph === g}
                onClick={() => setGlyph(g)}
                className={cn(
                    'grid aspect-square place-items-center rounded-lg border transition-colors duration-150',
                    glyph === g ? 'border-foreground/40 bg-muted' : 'border-border hover:bg-muted/60'
                )}
                style={{ color: glyph === g ? tint : undefined }}
            >
                <Glyph className='size-4' aria-hidden />
            </button>
        );
    };

    const submit = async () => {
        setBusy(true);
        try {
            const next: ServerMeta = {
                group: group.trim() || undefined,
                color: color || undefined,
                icon: glyph ? { glyph, tint: color || undefined } : undefined,
                note: note.trim() || undefined,
            };
            await save(next);
            if (canRename && name.trim() && name.trim() !== server.attributes.name) {
                await http.post(`/api/client/servers/${identifier}/settings/rename`, {
                    name: name.trim(),
                    description: server.attributes.description ?? '',
                });
                await client.invalidateQueries();
            }
            toast.success('Saved.');
            onClose();
        } catch (error) {
            toast.error(httpErrorToHuman(error));
        } finally {
            setBusy(false);
        }
    };

    const upload = async (picked: File | undefined) => {
        if (!picked) return;
        setBusy(true);
        try {
            await uploadFiles(identifier, '/', [await toServerIcon(picked)]);
            setGlyph(null);
            await save({ ...current, icon: undefined });
            await client.invalidateQueries({ queryKey: iconQueryKey(identifier) });
            toast.success('Uploaded as server-icon.png. Minecraft shows it after a restart.');
        } catch (error) {
            toast.error(httpErrorToHuman(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open onClose={onClose} title='Customize server'>
            <div className='flex flex-col gap-5'>
                <div className='flex items-center gap-4'>
                    {glyph ? (
                        <TemplateIcon glyph={glyph} tint={tint} size={64} />
                    ) : (
                        <ServerIcon identifier={identifier} uuid={uuid} size={64} />
                    )}
                    <div className='min-w-0 flex-1'>
                        <label className={label} htmlFor='obs-name'>
                            Name
                        </label>
                        <input
                            id='obs-name'
                            value={name}
                            disabled={!canRename}
                            maxLength={191}
                            onChange={(e) => setName(e.target.value)}
                            className={cn(field, 'disabled:opacity-60')}
                        />
                    </div>
                </div>

                <div>
                    <span className={label}>Icon</span>
                    <div className='grid grid-cols-5 gap-1.5 sm:grid-cols-10'>
                        {GLYPH_NAMES.slice(0, 10).map(glyphButton)}
                    </div>
                    <Collapse open={moreIcons || (glyph !== null && GLYPH_NAMES.indexOf(glyph) >= 10)}>
                        <div className='grid grid-cols-5 gap-1.5 pt-1.5 sm:grid-cols-10'>
                            {GLYPH_NAMES.slice(10).map(glyphButton)}
                        </div>
                    </Collapse>
                    <div className='mt-2 flex flex-wrap gap-2'>
                        <Button size='xsmall' color='grey' onClick={() => setMoreIcons(!moreIcons)}>
                            {moreIcons ? 'Fewer icons' : 'More icons'}
                        </Button>
                        <Button size='xsmall' color='grey' disabled={busy} onClick={() => file.current?.click()}>
                            <ImageUp className='size-3.5' aria-hidden /> Upload image
                        </Button>
                        <Button size='xsmall' color='grey' disabled={busy || !glyph} onClick={() => setGlyph(null)}>
                            <RotateCcw className='size-3.5' aria-hidden /> Use server-icon.png
                        </Button>
                        <input
                            ref={file}
                            type='file'
                            accept='image/png,image/jpeg,image/webp,image/gif'
                            hidden
                            onChange={(e) => void upload(e.target.files?.[0])}
                        />
                    </div>
                </div>

                <div>
                    <span className={label}>Colour</span>
                    <div className='flex flex-wrap items-center gap-2'>
                        <button
                            type='button'
                            onClick={() => setColor('')}
                            aria-pressed={color === ''}
                            className={cn(
                                'h-7 rounded-full border px-3 text-xs font-semibold',
                                color === '' ? 'border-foreground/40 bg-muted' : 'border-border'
                            )}
                        >
                            Auto
                        </button>
                        {TINTS.slice(0, 6).map((t) => (
                            <button
                                key={t}
                                type='button'
                                aria-label={`Colour ${t}`}
                                aria-pressed={color === t}
                                onClick={() => setColor(t)}
                                className={cn(
                                    'size-7 rounded-full border-2 transition',
                                    color === t ? 'scale-110 border-foreground' : 'border-transparent'
                                )}
                                style={{ background: t }}
                            />
                        ))}
                        <input
                            type='color'
                            aria-label='Custom colour'
                            value={color || tint}
                            onChange={(e) => setColor(e.target.value)}
                            className='size-7 cursor-pointer rounded-full border border-border bg-transparent p-0'
                        />
                    </div>
                </div>

                <div className='grid gap-4 sm:grid-cols-2'>
                    <div>
                        <label className={label} htmlFor='obs-group'>
                            Group
                        </label>
                        <input
                            id='obs-group'
                            list='obs-groups'
                            value={group}
                            maxLength={40}
                            placeholder='e.g. Network, Testing'
                            onChange={(e) => setGroup(e.target.value)}
                            className={field}
                        />
                        <datalist id='obs-groups'>
                            {suggestions.map((g) => (
                                <option key={g} value={g} />
                            ))}
                        </datalist>
                    </div>
                    <div>
                        <label className={label} htmlFor='obs-note'>
                            Note
                        </label>
                        <input
                            id='obs-note'
                            value={note}
                            maxLength={140}
                            placeholder='Shown under the name'
                            onChange={(e) => setNote(e.target.value)}
                            className={field}
                        />
                    </div>
                </div>
                <p className='text-xs text-muted-foreground'>
                    Saved in this server's <code className='font-mono'>.obsidian.json</code>, so everyone with access
                    sees it.
                </p>
            </div>
            <Dialog.Footer>
                <Button color='grey' onClick={onClose} disabled={busy}>
                    Cancel
                </Button>
                <Button onClick={submit} isLoading={busy} disabled={busy}>
                    Save
                </Button>
            </Dialog.Footer>
        </Dialog>
    );
}
