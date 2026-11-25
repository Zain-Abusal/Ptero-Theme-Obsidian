import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import SoftwareLogo from './SoftwareLogo';

afterEach(cleanup);

const KNOWN = ['paper', 'purpur', 'folia', 'vanilla', 'fabric', 'velocity', 'spigot', 'forge', 'neoforge'] as const;

test('renders project logos or distinct fallback marks for supported server software', () => {
    const markup = new Set<string>();

    for (const software of KNOWN) {
        const { container, unmount } = render(<SoftwareLogo software={software} className='size-6' />);
        const svg = container.querySelector('svg');
        const image = container.querySelector('img');
        expect(svg || image).not.toBeNull();
        if (image) {
            expect(image.getAttribute('aria-hidden')).toBe('true');
            expect(image.getAttribute('class')).toContain('size-6');
            expect(image.getAttribute('src')).toBeTruthy();
            markup.add(image.getAttribute('src')!);
        } else {
            expect(svg?.getAttribute('aria-hidden')).toBe('true');
            expect(svg?.getAttribute('class')).toContain('size-6');
            expect(svg?.getAttribute('class')).not.toContain('lucide-box');
            expect(svg?.innerHTML).toContain('currentColor');
            markup.add(svg!.innerHTML);
        }
        unmount();
    }

    expect(markup.size).toBe(KNOWN.length);
});

test('falls back to the Lucide Box icon for unknown software', () => {
    for (const software of ['unknown', 'bungeecord', '']) {
        const { container, unmount } = render(<SoftwareLogo software={software} className='size-6' />);
        const svg = container.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.getAttribute('class')).toContain('lucide-box');
        expect(svg?.getAttribute('class')).toContain('size-6');
        unmount();
    }
});
