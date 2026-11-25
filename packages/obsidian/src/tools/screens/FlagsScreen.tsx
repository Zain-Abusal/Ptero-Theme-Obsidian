import { useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, Cpu, Flag, Info, Sparkles, Terminal, TriangleAlert, Zap } from 'lucide-react';
import {
    Alert,
    Badge,
    Button,
    PanelLink,
    Spinner,
    Switch,
    TextArea,
    cn,
    toast,
    useServerPermission,
    useServerStartup,
} from '@pterodactyl/sdk';
import Collapse from '../../ui/Collapse';
import {
    DEFAULT_UNLIMITED_MEMORY_MB,
    FLAG_PRESETS,
    TWELVE_GB_MB,
    detectPreset,
    findFlagsVariable,
    findReadOnlyFlagsVariable,
    formatMemory,
    headroomMemoryMb,
    normalizeMemoryMb,
    parseJavaMajor,
    presetById,
    previewStartupCommand,
    startupHasMemoryFlags,
    stripMemoryFlags,
    type PresetId,
} from '../lib/flags';
import { useToolkit } from '../lib/useToolkit';
import Page, { Eyebrow, Panel, Step, attempt } from '../ui/Page';

const PRESET_ICONS: Record<PresetId, typeof Sparkles> = {
    aikar: Sparkles,
    zgc: Zap,
    shenandoah: Cpu,
    vanilla: Terminal,
};

export default function FlagsScreen({ embedded = false }: { embedded?: boolean }) {
    const { server, id, api } = useToolkit();
    const startupQuery = useServerStartup(id);
    const startup = startupQuery.data;
    const canUpdate = useServerPermission('startup.update');

    const limitMb = server.attributes.limits.memory;
    const [customMemory, setCustomMemory] = useState(DEFAULT_UNLIMITED_MEMORY_MB);
    const baseMemoryMb = limitMb > 0 ? limitMb : normalizeMemoryMb(customMemory);

    const [selected, setSelected] = useState<PresetId>('aikar');
    const [customFlags, setCustomFlags] = useState('');
    const [reserveHeadroom, setReserveHeadroom] = useState(false);
    const [includeMemory, setIncludeMemory] = useState(true);
    const [showCommand, setShowCommand] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [synced, setSynced] = useState(false);

    const editableVar = findFlagsVariable(startup);
    const readOnlyVar = editableVar ? null : findReadOnlyFlagsVariable(startup);
    const currentVar = editableVar ?? readOnlyVar;
    const activePreset = currentVar ? detectPreset(currentVar.value) : null;
    const javaMajor = parseJavaMajor(server.attributes.docker_image);

    useEffect(() => {
        if (synced || !currentVar?.value) return;
        const detected = detectPreset(currentVar.value);
        if (detected) setSelected(detected);
        setSynced(true);
    }, [currentVar?.value, synced]);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), 1800);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const preset = presetById(selected);
    const heapMb = reserveHeadroom ? headroomMemoryMb(baseMemoryMb) : normalizeMemoryMb(baseMemoryMb);
    const rawFlags = preset.generate(heapMb);
    const generatedFlags = includeMemory ? rawFlags : stripMemoryFlags(rawFlags);
    useEffect(() => setCustomFlags(generatedFlags), [generatedFlags]);
    const hasCommandMemory = startupHasMemoryFlags(startup, currentVar?.key);
    const commandPreview = currentVar
        ? previewStartupCommand(startup, currentVar.key, customFlags, baseMemoryMb)
        : null;
    const isUnchanged = editableVar !== null && editableVar.value.trim() === customFlags.trim();

    const copy = async (text: string) => {
        if (!navigator.clipboard) {
            toast.error('Clipboard access is not available in this browser.');
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success('Flags copied to clipboard.');
        } catch {
            toast.error('Could not copy flags.');
        }
    };

    const apply = async () => {
        if (!editableVar) return;
        setSaving(true);
        await attempt(
            () => api.setVariable(editableVar.key, customFlags),
            `Applied ${preset.label} to ${editableVar.key}. Restart the server to use them.`,
            toast
        );
        setSaving(false);
    };

    const content = (
        <>
            <div className='rounded-xl border border-border bg-card p-5'>
                <div className='flex items-start gap-3.5 sm:items-center sm:gap-4'>
                    <span className='grid size-12 shrink-0 place-items-center rounded-xl border border-border bg-muted sm:size-14'>
                        <Flag className='size-5 sm:size-6' aria-hidden />
                    </span>
                    <div className='min-w-0 flex-1'>
                        <Eyebrow>Allocated memory</Eyebrow>
                        <p className='text-2xl font-bold tracking-tight'>
                            {limitMb > 0 ? formatMemory(limitMb) : 'Unlimited'}{' '}
                            <span className='text-base font-semibold text-muted-foreground'>
                                {limitMb > 0 ? `${limitMb} MB` : `${heapMb} MB target`}
                            </span>
                        </p>
                        <div className='mt-1.5 flex flex-wrap gap-2'>
                            {javaMajor !== null && (
                                <Badge size='sm' tone='neutral' variant='soft'>
                                    Java {javaMajor}
                                </Badge>
                            )}
                            {editableVar && (
                                <Badge size='sm' tone='success' variant='soft'>
                                    <span className='font-mono'>{editableVar.key}</span>
                                </Badge>
                            )}
                            {readOnlyVar && (
                                <Badge size='sm' tone='warning' variant='soft'>
                                    <span className='font-mono'>{readOnlyVar.key}</span> (read-only)
                                </Badge>
                            )}
                            {!startupQuery.isLoading && !currentVar && (
                                <Badge size='sm' tone='neutral' variant='soft'>
                                    No flags variable
                                </Badge>
                            )}
                            {activePreset && (
                                <Badge size='sm' tone='info' variant='soft'>
                                    {presetById(activePreset).label}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                {currentVar && (
                    <div className='mt-4 border-t border-border pt-4'>
                        <div className='flex items-center justify-between gap-2'>
                            <Eyebrow>Current {currentVar.key}</Eyebrow>
                            {currentVar.value.trim() && (
                                <button
                                    type='button'
                                    onClick={() => void copy(currentVar.value)}
                                    className='text-xs font-semibold text-muted-foreground hover:text-foreground'
                                >
                                    Copy current
                                </button>
                            )}
                        </div>
                        {currentVar.value.trim() ? (
                            <pre className='mt-2 overflow-x-auto rounded-lg border border-border bg-sunken px-3 py-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-foreground'>
                                {currentVar.value}
                            </pre>
                        ) : (
                            <p className='mt-1.5 text-xs text-muted-foreground'>
                                Empty. No JVM flags are currently set in {currentVar.key}.
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]'>
                <div className='min-w-0'>
                    <Step n={1}>Flag preset</Step>
                    <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
                        {FLAG_PRESETS.map((item) => {
                            const Glyph = PRESET_ICONS[item.id];
                            const isSelected = selected === item.id;
                            const isCurrent = activePreset === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type='button'
                                    aria-pressed={isSelected}
                                    onClick={() => setSelected(item.id)}
                                    className={cn(
                                        'flex items-start gap-3 rounded-xl border p-3.5 text-left transition',
                                        isSelected
                                            ? 'border-foreground/30 bg-muted'
                                            : 'border-border bg-card hover:bg-muted/50'
                                    )}
                                >
                                    <span className='grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-background'>
                                        <Glyph className='size-4' aria-hidden />
                                    </span>
                                    <span className='min-w-0 flex-1'>
                                        <span className='flex flex-wrap items-center gap-1.5 text-sm font-bold'>
                                            <span>{item.label}</span>
                                            {isCurrent ? (
                                                <Badge size='sm' tone='success' variant='soft'>
                                                    Current
                                                </Badge>
                                            ) : (
                                                item.recommended && (
                                                    <Badge size='sm' tone='info' variant='soft'>
                                                        Recommended
                                                    </Badge>
                                                )
                                            )}
                                            <Badge size='sm' tone='neutral' variant='soft'>
                                                {item.java}
                                            </Badge>
                                        </span>
                                        <span className='mt-1 block text-xs text-muted-foreground'>
                                            {item.description}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className='mt-7'>
                        <Step n={2}>Generated flags</Step>
                        <Panel
                            title={preset.label}
                            aside={
                                <Button size='xsmall' color='grey' onClick={() => void copy(customFlags)}>
                                    {copied ? (
                                        <Check className='size-3.5 text-success' aria-hidden />
                                    ) : (
                                        <Copy className='size-3.5' aria-hidden />
                                    )}
                                    {copied ? 'Copied' : 'Copy'}
                                </Button>
                            }
                        >
                            <TextArea
                                rows={6}
                                aria-label='Editable JVM flags'
                                value={customFlags}
                                onChange={(e) => setCustomFlags(e.currentTarget.value)}
                                className='w-full resize-y px-3 py-2.5 font-mono text-xs leading-relaxed'
                            />
                            <p className='mt-2 text-xs text-muted-foreground'>Edit these flags before applying them.</p>
                            <div className='mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'>
                                <span>
                                    {includeMemory
                                        ? `Heap set to -Xms${heapMb}M -Xmx${heapMb}M`
                                        : 'Memory flags (-Xms / -Xmx) omitted'}
                                </span>
                                {commandPreview && (
                                    <button
                                        type='button'
                                        aria-expanded={showCommand}
                                        onClick={() => setShowCommand((open) => !open)}
                                        className='inline-flex items-center gap-1 font-semibold text-foreground hover:underline'
                                    >
                                        <span>Preview startup command</span>
                                        <ChevronDown
                                            className={cn('size-3.5 transition', showCommand && 'rotate-180')}
                                            aria-hidden
                                        />
                                    </button>
                                )}
                            </div>
                            <Collapse open={showCommand && Boolean(commandPreview)}>
                                <pre className='mt-3 overflow-x-auto rounded-lg border border-border bg-terminal p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-terminal-foreground'>
                                    {commandPreview}
                                </pre>
                            </Collapse>
                        </Panel>
                    </div>
                </div>

                <div className='flex flex-col gap-4'>
                    <Panel title={editableVar ? 'Apply flags' : 'Startup setup'}>
                        {limitMb <= 0 && (
                            <div className='mb-4 flex items-center justify-between gap-3 border-b border-border pb-4'>
                                <label htmlFor='obs-flags-heap-mb' className='text-sm'>
                                    Target heap
                                    <span className='block text-xs text-muted-foreground'>
                                        Memory limit is unlimited
                                    </span>
                                </label>
                                <div className='flex items-center gap-1.5'>
                                    <input
                                        id='obs-flags-heap-mb'
                                        type='number'
                                        min={512}
                                        step={512}
                                        value={customMemory}
                                        onChange={(e) => setCustomMemory(Math.max(512, Number(e.target.value) || 512))}
                                        className='h-9 w-24 rounded-lg border border-input-border bg-input px-2.5 text-right font-mono text-sm outline-none focus:ring-2 focus:ring-ring'
                                    />
                                    <span className='text-xs text-muted-foreground'>MB</span>
                                </div>
                            </div>
                        )}

                        <div className='flex flex-col gap-4'>
                            <Switch
                                checked={reserveHeadroom}
                                onChange={setReserveHeadroom}
                                disabled={!includeMemory}
                                label='Reserve container headroom'
                                description={`Sets heap to ${headroomMemoryMb(baseMemoryMb)}M to leave room for off-heap memory`}
                                controlPosition='end'
                            />
                            <Switch
                                checked={includeMemory}
                                onChange={setIncludeMemory}
                                label='Include -Xms and -Xmx'
                                description='Turn off if your egg sets heap size elsewhere'
                                controlPosition='end'
                            />
                        </div>

                        {preset.id === 'aikar' && heapMb > TWELVE_GB_MB && includeMemory && (
                            <p className='mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground'>
                                Heap exceeds 12 GB, using large-heap Aikar tuning (40 / 50 / 20).
                            </p>
                        )}

                        {hasCommandMemory && includeMemory && (
                            <p className='mt-3 flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground'>
                                <Info className='size-4 shrink-0' aria-hidden />
                                <span>
                                    Your startup command already passes -Xmx or MaxRAMPercentage. Turn off Include -Xms
                                    and -Xmx if Java rejects duplicate flags.
                                </span>
                            </p>
                        )}

                        {preset.id === 'zgc' && javaMajor !== null && javaMajor < 21 && (
                            <p className='mt-3 flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning'>
                                <TriangleAlert className='size-4 shrink-0' aria-hidden />
                                <span>
                                    Generational ZGC needs Java 21+. Your runtime looks like Java {javaMajor}. Switch it
                                    in{' '}
                                    <PanelLink
                                        destination={{ to: '/server/$id/mc/versions' as '/server/$id', params: { id } }}
                                        className='font-semibold underline'
                                    >
                                        Versions
                                    </PanelLink>
                                    .
                                </span>
                            </p>
                        )}

                        <div className='mt-5'>
                            {startupQuery.isLoading ? (
                                <Spinner centered />
                            ) : editableVar ? (
                                canUpdate ? (
                                    <>
                                        <Button
                                            size='xlarge'
                                            disabled={saving || isUnchanged}
                                            isLoading={saving}
                                            onClick={apply}
                                        >
                                            {isUnchanged
                                                ? `Already set on ${editableVar.key}`
                                                : `Apply to ${editableVar.key}`}
                                        </Button>
                                        <p className='mt-3 text-xs text-muted-foreground'>
                                            Updates <span className='font-mono'>{editableVar.key}</span>. Restart the
                                            server to apply the new flags.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <Alert type='info'>
                                            You need startup.update permission to change variables. Copy the generated
                                            flags and ask an admin to update{' '}
                                            <span className='font-mono'>{editableVar.key}</span>.
                                        </Alert>
                                        <Button
                                            size='xlarge'
                                            color='grey'
                                            className='mt-3'
                                            onClick={() => void copy(customFlags)}
                                        >
                                            {copied ? (
                                                <Check className='size-4 text-success' aria-hidden />
                                            ) : (
                                                <Copy className='size-4' aria-hidden />
                                            )}
                                            {copied ? 'Copied flags' : 'Copy flags'}
                                        </Button>
                                    </>
                                )
                            ) : (
                                <>
                                    <Alert type='warning'>
                                        {readOnlyVar ? (
                                            <>
                                                <span className='font-mono'>{readOnlyVar.key}</span> is read-only on
                                                this egg. Copy the flags below and ask your panel admin to update them
                                                or make the variable editable.
                                            </>
                                        ) : (
                                            <>
                                                No editable JVM flags variable was found on this egg. Copy the flags
                                                below and ask your panel admin to add a{' '}
                                                <span className='font-mono'>STARTUP_FLAGS</span> variable or update your
                                                startup command.
                                            </>
                                        )}
                                    </Alert>
                                    <pre className='mt-3 max-h-40 overflow-y-auto rounded-lg border border-border bg-sunken p-3 font-mono text-[0.72rem] leading-relaxed break-all whitespace-pre-wrap text-foreground'>
                                        {customFlags}
                                    </pre>
                                    <Button size='xlarge' className='mt-3' onClick={() => void copy(customFlags)}>
                                        {copied ? (
                                            <Check className='size-4' aria-hidden />
                                        ) : (
                                            <Copy className='size-4' aria-hidden />
                                        )}
                                        {copied ? 'Copied flags' : 'Copy flags'}
                                    </Button>
                                </>
                            )}
                        </div>
                    </Panel>
                </div>
            </div>
        </>
    );
    return embedded ? (
        <div className='mt-8 border-t border-border pt-8'>
            <h2 className='text-xl font-bold tracking-tight'>JVM flags</h2>
            <p className='mb-5 mt-1 text-sm text-muted-foreground'>Choose a preset, edit its flags, then apply them.</p>
            {content}
        </div>
    ) : (
        <Page title='Startup' description='Choose a preset, edit the flags, then apply them to the startup variable.'>
            {content}
        </Page>
    );
}
