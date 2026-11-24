import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn, http } from '@pterodactyl/sdk';
import { GLYPHS, GLYPH_NAMES } from './glyphs';
import { defaultTint, hash, useServerMeta } from './serverMeta';

export const iconQueryKey = (identifier: string) => ['obsidian', 'icon', identifier] as const;

/** A template tile: the glyph in its tint over a tinted wash, so it matches whichever surface is in use. */
export function TemplateIcon({ glyph, tint, size, className }: { glyph: string; tint: string; size: number; className?: string }) {
    const Glyph = GLYPHS[glyph] ?? GLYPHS.box;

    return (
        <span
            className={cn('grid shrink-0 place-items-center overflow-hidden rounded-[28%] border', className)}
            style={{
                width: size,
                height: size,
                color: tint,
                borderColor: `color-mix(in oklab, ${tint} 32%, var(--border))`,
                background: `linear-gradient(155deg, color-mix(in oklab, ${tint} 26%, var(--card)), color-mix(in oklab, ${tint} 8%, var(--card)))`,
            }}
        >
            <Glyph style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={2} aria-hidden />
        </span>
    );
}

/**
 * A server's icon: the template the owner picked, else the server's own server-icon.png, else a template
 * chosen from its UUID so every server has a stable, on-theme icon.
 */
export default function ServerIcon({
    identifier,
    uuid,
    size = 44,
    className,
}: {
    identifier: string;
    uuid: string;
    size?: number;
    className?: string;
}) {
    const meta = useServerMeta(identifier);
    const picked = meta.icon?.glyph ? meta.icon : null;
    const { data } = useQuery({
        queryKey: iconQueryKey(identifier),
        queryFn: async () => {
            const response = await http.get<Blob>(`/api/client/servers/${identifier}/files/contents`, {
                params: { file: '/server-icon.png' },
                responseType: 'blob',
            });
            return response.data.size > 0 ? response.data : null;
        },
        enabled: !picked,
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
    });
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!data || picked) return setUrl(null);
        const objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [data, picked]);

    const tint = picked?.tint ?? meta.color ?? defaultTint(uuid);

    if (url) {
        return (
            <span
                className={cn('grid shrink-0 place-items-center overflow-hidden rounded-[28%] border border-border bg-muted', className)}
                style={{ width: size, height: size }}
            >
                <img src={url} alt='' className='size-full object-cover [image-rendering:pixelated]' />
            </span>
        );
    }

    return (
        <TemplateIcon
            glyph={picked?.glyph ?? GLYPH_NAMES[hash(`${uuid}:glyph`) % GLYPH_NAMES.length]}
            tint={tint}
            size={size}
            className={className}
        />
    );
}
