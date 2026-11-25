import type { SdkServerStartup } from '@pterodactyl/sdk';

export type PresetId = 'aikar' | 'zgc' | 'shenandoah' | 'vanilla';

export interface FlagPreset {
    readonly id: PresetId;
    readonly label: string;
    readonly description: string;
    readonly java: string;
    readonly recommended?: boolean;
    generate(memoryMb: number): string;
}

export interface FlagsVariable {
    readonly key: string;
    readonly name: string;
    readonly value: string;
    readonly editable: boolean;
}

export const TWELVE_GB_MB = 12 * 1024;
export const DEFAULT_UNLIMITED_MEMORY_MB = 4096;

export function normalizeMemoryMb(memoryMb: number): number {
    if (!Number.isFinite(memoryMb) || memoryMb <= 0) return DEFAULT_UNLIMITED_MEMORY_MB;
    return Math.round(memoryMb);
}

export function headroomMemoryMb(memoryMb: number): number {
    const mem = normalizeMemoryMb(memoryMb);
    if (mem <= 512) return mem;
    const reserve = Math.min(2048, Math.max(256, Math.round(mem * 0.15)));
    return Math.max(512, mem - reserve);
}

export function stripMemoryFlags(flags: string): string {
    return flags
        .replace(/(?:^|\s)-Xm[sx]\S+/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

export const FLAG_PRESETS: readonly FlagPreset[] = [
    {
        id: 'aikar',
        label: "Aikar's flags",
        description: 'Tuned G1GC flags for Paper, Purpur, and modded servers.',
        java: 'Java 17+',
        recommended: true,
        generate(memoryMb) {
            const mem = normalizeMemoryMb(memoryMb);
            const large = mem > TWELVE_GB_MB;
            const newSize = large ? 40 : 30;
            const maxNewSize = large ? 50 : 40;
            const ihope = large ? 20 : 15;
            return [
                `-Xms${mem}M`,
                `-Xmx${mem}M`,
                '-XX:+UseG1GC',
                '-XX:+ParallelRefProcEnabled',
                '-XX:MaxGCPauseMillis=200',
                '-XX:+UnlockExperimentalVMOptions',
                '-XX:+DisableExplicitGC',
                '-XX:+AlwaysPreTouch',
                `-XX:G1NewSizePercent=${newSize}`,
                `-XX:G1MaxNewSizePercent=${maxNewSize}`,
                '-XX:G1HeapRegionSize=8M',
                '-XX:G1ReservePercent=20',
                '-XX:G1HeapWastePercent=5',
                '-XX:G1MixedGCCountTarget=4',
                `-XX:InitiatingHeapOccupancyPercent=${ihope}`,
                '-XX:G1MixedGCLiveThresholdPercent=90',
                '-XX:G1RSetUpdatingPauseTimePercent=5',
                '-XX:SurvivorRatio=32',
                '-XX:+PerfDisableSharedMem',
                '-XX:MaxTenuringThreshold=1',
            ].join(' ');
        },
    },
    {
        id: 'zgc',
        label: 'Generational ZGC',
        description: 'Ultra-low GC pauses for large heaps on Java 21+ servers.',
        java: 'Java 21+',
        generate(memoryMb) {
            const mem = normalizeMemoryMb(memoryMb);
            return [
                `-Xms${mem}M`,
                `-Xmx${mem}M`,
                '-XX:+UseZGC',
                '-XX:+ZGenerational',
                '-XX:+AlwaysPreTouch',
                '-XX:+DisableExplicitGC',
            ].join(' ');
        },
    },
    {
        id: 'shenandoah',
        label: 'Shenandoah',
        description: 'Concurrent low-pause collector for steady server tick times.',
        java: 'Java 17+',
        generate(memoryMb) {
            const mem = normalizeMemoryMb(memoryMb);
            return [
                `-Xms${mem}M`,
                `-Xmx${mem}M`,
                '-XX:+UnlockExperimentalVMOptions',
                '-XX:+UseShenandoahGC',
                '-XX:ShenandoahGCMode=iu',
                '-XX:+AlwaysPreTouch',
                '-XX:+DisableExplicitGC',
            ].join(' ');
        },
    },
    {
        id: 'vanilla',
        label: 'Basic',
        description: 'Only sets -Xms and -Xmx heap limits with default GC.',
        java: 'Java 8+',
        generate(memoryMb) {
            const mem = normalizeMemoryMb(memoryMb);
            return `-Xms${mem}M -Xmx${mem}M`;
        },
    },
];

export const presetById = (id: PresetId): FlagPreset => FLAG_PRESETS.find((p) => p.id === id) ?? FLAG_PRESETS[0];

const FLAG_VARIABLE_PRIORITY = [
    'STARTUP_FLAGS',
    'JVM_FLAGS',
    'JVM_ARGS',
    'JAVA_FLAGS',
    'JAVA_ARGS',
    'JAVA_ARGUMENTS',
    'ADDITIONAL_FLAGS',
    'EXTRA_FLAGS',
    'FLAGS',
    'MC_FLAGS',
    'SERVER_FLAGS',
    'AIKAR_FLAGS',
    'CUSTOM_FLAGS',
    'JVM_OPTS',
    'JAVA_OPTS',
    'STARTUP_ARGS',
];

const FLAG_VARIABLE_PATTERN = /^(?:[A-Z0-9]+_)*(?:FLAGS|ARGS|ARGUMENTS)$|^(?:JVM|JAVA)_OPTS$/i;

function scanFlagsVariable(startup: SdkServerStartup | undefined, editable: boolean): FlagsVariable | null {
    const entries = (startup?.data ?? []).filter((entry) => entry.attributes.is_editable === editable);
    if (entries.length === 0) return null;

    const toResult = (entry: (typeof entries)[number]): FlagsVariable => ({
        key: entry.attributes.env_variable,
        name: entry.attributes.name,
        value: entry.attributes.server_value ?? entry.attributes.default_value ?? '',
        editable: entry.attributes.is_editable,
    });

    for (const candidate of FLAG_VARIABLE_PRIORITY) {
        const hit = entries.find((entry) => entry.attributes.env_variable.toUpperCase() === candidate);
        if (hit) return toResult(hit);
    }

    const fallback = entries.find((entry) => FLAG_VARIABLE_PATTERN.test(entry.attributes.env_variable));
    return fallback ? toResult(fallback) : null;
}

export function findFlagsVariable(startup: SdkServerStartup | undefined): FlagsVariable | null {
    return scanFlagsVariable(startup, true);
}

export function findReadOnlyFlagsVariable(startup: SdkServerStartup | undefined): FlagsVariable | null {
    return scanFlagsVariable(startup, false);
}

export function detectPreset(flags: string): PresetId | null {
    const trimmed = flags.trim();
    if (!trimmed) return null;
    if (/-XX:\+UseZGC\b/i.test(trimmed)) return 'zgc';
    if (/-XX:\+UseShenandoahGC\b/i.test(trimmed)) return 'shenandoah';
    if (/-XX:\+UseG1GC\b/i.test(trimmed) && /G1NewSizePercent/i.test(trimmed)) return 'aikar';
    if (/^-Xms\S+\s+-Xmx\S+$/i.test(trimmed)) return 'vanilla';
    return null;
}

export function startupHasMemoryFlags(startup: SdkServerStartup | undefined, variableKey?: string | null): boolean {
    const raw = startup?.meta?.raw_startup_command ?? '';
    if (!raw) return false;
    const withoutVar = variableKey ? raw.replaceAll(`{{${variableKey}}}`, '') : raw;
    return /(?:^|\s)(?:-Xmx\S*|-XX:MaxRAMPercentage=\S*)/i.test(withoutVar);
}

export function previewStartupCommand(
    startup: SdkServerStartup | undefined,
    variableKey: string,
    nextFlags: string,
    memoryMb: number
): string | null {
    const raw = startup?.meta?.raw_startup_command;
    if (!raw) return null;

    const values = new Map<string, string>();
    for (const entry of startup?.data ?? []) {
        values.set(
            entry.attributes.env_variable,
            entry.attributes.server_value ?? entry.attributes.default_value ?? ''
        );
    }
    values.set(variableKey, nextFlags);
    values.set('SERVER_MEMORY', String(normalizeMemoryMb(memoryMb)));

    return raw
        .replace(/\{\{([A-Z0-9_]+)\}\}/gi, (match, key: string) => values.get(key) ?? match)
        .replace(/\s{2,}/g, ' ')
        .trim();
}

export function parseJavaMajor(dockerImage: string | undefined): number | null {
    if (!dockerImage) return null;
    const match = /(?:java|jdk|temurin|corretto|graalvm)[_:/-](\d+)/i.exec(dockerImage);
    if (match) return Number(match[1]);
    const tail = /:(\d+)(?:[-_]|$)/.exec(dockerImage);
    return tail ? Number(tail[1]) : null;
}

export function formatMemory(memoryMb: number): string {
    if (!Number.isFinite(memoryMb) || memoryMb <= 0) return 'Unlimited';
    if (memoryMb >= 1024 && memoryMb % 1024 === 0) return `${memoryMb / 1024} GB`;
    if (memoryMb >= 1024) return `${(memoryMb / 1024).toFixed(1)} GB`;
    return `${memoryMb} MB`;
}
