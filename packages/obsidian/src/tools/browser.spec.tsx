import { useState } from 'react';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import {
    createExtensionTestHost,
    createTestServer,
    preloadTheme,
    renderWithTheme,
    type ExtensionTestHost,
    type RenderedView,
} from '@pterodactyl/sdk/testing';
import type { Installed } from './lib/minecraft';
import theme from '../theme';

let toolkitState: {
    server: ReturnType<typeof createTestServer>;
    id: string;
    api: Record<string, never>;
    installed: Installed | undefined;
    loading: boolean;
    loaders: string[];
    gameVersion: string | null;
    refresh: () => void;
};

vi.mock('./lib/useToolkit', () => ({
    useToolkit: () => toolkitState,
    useDirectory: () => ({ data: [], isLoading: false }),
}));

import { Browser } from './screens/BrowserScreen';

let host: ExtensionTestHost | undefined;
let rendered: RenderedView | undefined;

beforeAll(() => preloadTheme([theme]));

afterEach(() => {
    rendered?.unmount();
    host?.dispose();
    host = undefined;
    vi.unstubAllGlobals();
});

test('avoids double-fetch when gameVersion loads, debounces MC version input, and forwards AbortSignal', async () => {
    const server = createTestServer({ eggFeatures: ['eula', 'java_version'], eggTags: ['minecraft'] });
    host = createExtensionTestHost({ server, path: `/server/${server.attributes.identifier}/mc/plugins` });

    toolkitState = {
        server,
        id: server.attributes.identifier,
        api: {},
        installed: undefined,
        loading: true,
        loaders: ['paper', 'spigot', 'bukkit'],
        gameVersion: null,
        refresh: vi.fn(),
    };

    const fetchMock = vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify({ hits: [], total_hits: 0 }), { status: 200 }))
    );
    vi.stubGlobal('fetch', fetchMock);

    let triggerRender!: () => void;
    function Harness() {
        const [, setTick] = useState(0);
        triggerRender = () => setTick((t) => t + 1);
        return <Browser kind='plugin' />;
    }

    rendered = renderWithTheme(
        <host.Wrapper>
            <Harness />
        </host.Wrapper>,
        { themes: [theme] }
    );

    const versionInput = (await waitFor(() => screen.getByLabelText('Minecraft version'))) as HTMLInputElement;
    expect(fetchMock).not.toHaveBeenCalled();

    toolkitState = {
        ...toolkitState,
        installed: { software: 'paper', version: '1.21.4' },
        loading: false,
        gameVersion: '1.21.4',
    };
    act(() => triggerRender());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(decodeURIComponent(firstUrl)).toContain('versions:1.21.4');
    expect(firstInit.signal).toBeInstanceOf(AbortSignal);

    expect(versionInput.value).toBe('1.21.4');

    fireEvent.change(versionInput, { target: { value: '1' } });
    fireEvent.change(versionInput, { target: { value: '1.2' } });
    fireEvent.change(versionInput, { target: { value: '1.20' } });
    expect(versionInput.value).toBe('1.20');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => new Promise((r) => setTimeout(r, 420)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(decodeURIComponent(secondUrl)).toContain('versions:1.20');
    expect(secondInit.signal).toBeInstanceOf(AbortSignal);

    toolkitState = {
        ...toolkitState,
        installed: { software: 'paper', version: '1.21.5' },
        gameVersion: '1.21.5',
    };
    act(() => triggerRender());
    await act(() => new Promise((r) => setTimeout(r, 50)));

    expect(versionInput.value).toBe('1.20');
    expect(fetchMock).toHaveBeenCalledTimes(2);
});
