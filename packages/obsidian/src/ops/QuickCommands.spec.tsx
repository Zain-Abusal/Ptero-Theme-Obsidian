import { useState } from 'react';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createTestServer, preloadTheme, renderWithTheme, type RenderedView } from '@pterodactyl/sdk/testing';
import type { ServerConsoleCommand } from '@pterodactyl/sdk/theme';
import theme from '../theme';
import QuickCommands from './QuickCommands';

const state = vi.hoisted(() => ({
    commands: [] as { label: string; command: string; confirm?: boolean }[],
    save: vi.fn(),
    submit: vi.fn(),
}));

vi.mock('./commands', () => ({
    useQuickCommands: () => ({ commands: state.commands, save: state.save }),
}));

let rendered: RenderedView | undefined;

beforeAll(() => preloadTheme([theme]));

afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    state.commands = [{ label: 'Save', command: 'save-all' }];
    state.save.mockReset();
    state.submit.mockReset();
    vi.restoreAllMocks();
});

function mount() {
    const server = createTestServer({ eggFeatures: ['eula', 'java_version'], eggTags: ['minecraft'] });

    function Harness() {
        const [value, setValue] = useState('');
        const command: ServerConsoleCommand = {
            allowed: true,
            disabled: false,
            value,
            history: [],
            setValue,
            previous: () => undefined,
            next: () => undefined,
            submit: state.submit,
        };

        return <QuickCommands server={server} command={command} />;
    }

    rendered = renderWithTheme(<Harness />, { themes: [theme] });
}

test('sends a quick command and asks before a command marked for confirmation', async () => {
    state.commands = [
        { label: 'Save', command: 'save-all' },
        { label: 'Whitelist on', command: 'whitelist on', confirm: true },
    ];
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(state.submit).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Whitelist on' }));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(state.submit).toHaveBeenCalledTimes(1);
});

test('saves a new per-server quick command', async () => {
    state.save.mockResolvedValue(true);
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Quick command label' }), {
        target: { value: 'Night' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Quick command' }), {
        target: { value: 'time set midnight' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
        expect(state.save).toHaveBeenCalledWith([
            { label: 'Save', command: 'save-all' },
            { label: 'Night', command: 'time set midnight' },
        ])
    );
});
