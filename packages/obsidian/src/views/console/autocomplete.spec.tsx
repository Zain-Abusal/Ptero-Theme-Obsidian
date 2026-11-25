import { useRef, useState } from 'react';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import {
    createExtensionTestHost,
    createTestServer,
    preloadTheme,
    renderWithTheme,
    type ExtensionTestHost,
    type RenderedView,
} from '@pterodactyl/sdk/testing';
import type { ServerTerminalModel } from '@pterodactyl/sdk/theme';
import theme from '../../theme';
import Terminal from '../Terminal';
import { COMMANDS, getSuggestions } from './autocomplete';

let host: ExtensionTestHost | undefined;
let rendered: RenderedView | undefined;

beforeAll(() => preloadTheme([theme]));

afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    host?.dispose();
    host = undefined;
});

test('returns no suggestions for empty or whitespace input', () => {
    expect(getSuggestions('', ['stop', 'say hi'])).toEqual([]);
    expect(getSuggestions('   ', ['stop', 'say hi'])).toEqual([]);
});

test('prioritizes history matches before command matches and deduplicates', () => {
    const suggestions = getSuggestions('sa', ['say Hello', 'save-all', 'stop']);

    expect(suggestions.slice(0, 4)).toEqual([
        { text: 'say Hello', source: 'history' },
        { text: 'save-all', source: 'history' },
        { text: 'save-on', source: 'command' },
        { text: 'save-off', source: 'command' },
    ]);
    expect(suggestions.filter((s) => s.text === 'save-all')).toHaveLength(1);
});

test('matches commands and arguments case-insensitively and caps at 8', () => {
    expect(getSuggestions('GA', [])).toEqual([
        { text: 'gamemode', source: 'command' },
        { text: 'gamerule', source: 'command' },
    ]);

    expect(getSuggestions('gamemode s', [])).toEqual([
        { text: 'gamemode survival', source: 'command' },
        { text: 'gamemode spectator', source: 'command' },
    ]);

    expect(getSuggestions('PAPER ', [])).toEqual([
        { text: 'paper reload', source: 'command' },
        { text: 'paper version', source: 'command' },
        { text: 'paper entity', source: 'command' },
    ]);

    expect(getSuggestions('gamerule keep', [])).toEqual([{ text: 'gamerule keepInventory', source: 'command' }]);

    expect(getSuggestions('gamemode survival ', [])).toEqual([]);
    expect(getSuggestions('gamemode survival ', ['gamemode survival Notch'])).toEqual([
        { text: 'gamemode survival Notch', source: 'history' },
    ]);

    const history = Array.from({ length: 12 }, (_, i) => `say msg ${i}`);
    expect(getSuggestions('say', history)).toHaveLength(8);
    expect(COMMANDS.some((c) => c.name === 'purpur' && c.args?.includes('reload'))).toBe(true);
});

const DummyCanvas = () => <div />;

async function mountTerminal({
    minecraft,
    history = ['say Hello', 'gamemode creative'],
    onSubmit = vi.fn(),
}: {
    minecraft: boolean;
    history?: string[];
    onSubmit?: (cmd: string) => void;
}) {
    const server = createTestServer(minecraft ? { eggFeatures: ['eula', 'java_version'], eggTags: ['minecraft'] } : {});
    host = createExtensionTestHost({ server });

    function Harness() {
        const [value, setValue] = useState('');
        const [entries, setEntries] = useState(history);
        const index = useRef(-1);

        const model: ServerTerminalModel = {
            Terminal: DummyCanvas,
            loading: false,
            failed: false,
            retry: () => {},
            scrolledUp: false,
            scrollToBottom: () => {},
            command: {
                allowed: true,
                disabled: false,
                value,
                history: entries,
                setValue,
                previous: () => {
                    const next = Math.min(index.current + 1, entries.length - 1);
                    index.current = next;
                    setValue(entries[next] ?? '');
                },
                next: () => {
                    const next = Math.max(index.current - 1, -1);
                    index.current = next;
                    setValue(entries[next] ?? '');
                },
                submit: () => {
                    if (!value) return;
                    onSubmit(value);
                    setEntries((prev) => [value, ...prev]);
                    index.current = -1;
                    setValue('');
                },
            },
        };

        return <Terminal model={model} Default={DummyCanvas} />;
    }

    rendered = renderWithTheme(
        <host.Wrapper>
            <Harness />
        </host.Wrapper>,
        { themes: [theme] }
    );
    return (await screen.findByRole('textbox', { name: 'Console command' })) as HTMLInputElement;
}

test('shows up to 6 suggestions on Minecraft servers and accepts via Tab, Enter, and click', async () => {
    const onSubmit = vi.fn();
    const input = await mountTerminal({
        minecraft: true,
        history: ['say one', 'say two', 'save-all', 'seed'],
        onSubmit,
    });

    fireEvent.change(input, { target: { value: 's' } });
    const listbox = screen.getByRole('listbox', { name: 'Command suggestions' });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(6);
    expect(listbox.textContent).toContain('history');
    expect(listbox.textContent).toContain('command');

    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.value).toBe('say one');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('say one');
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: 'gam' } });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('gamemode');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.change(input, { target: { value: 'gamemode ' } });
    fireEvent.click(screen.getByRole('option', { name: /gamemode survival/ }));
    expect(input.value).toBe('gamemode survival');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.change(input, { target: { value: 'ti' } });
    expect(screen.getByRole('listbox')).not.toBeNull();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const tiOptions = screen.getAllByRole('option');
    expect(tiOptions[tiOptions.length - 1].getAttribute('aria-selected')).toBe('true');
    expect(tiOptions[tiOptions.length - 1].className).toContain('bg-muted');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.value).toBe('ti');

    fireEvent.change(input, { target: { value: 'tim' } });
    expect(screen.getByRole('listbox')).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
});

test('steps through history with ArrowUp without opening suggestions when dropdown is closed', async () => {
    const input = await mountTerminal({ minecraft: true, history: ['list', 'tps'] });

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('list');
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.value).toBe('tps');
    expect(screen.queryByRole('listbox')).toBeNull();
});

test('disables suggestions on non-Minecraft servers', async () => {
    const onSubmit = vi.fn();
    const input = await mountTerminal({ minecraft: false, onSubmit });

    fireEvent.change(input, { target: { value: 'gam' } });
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('gam');
});
