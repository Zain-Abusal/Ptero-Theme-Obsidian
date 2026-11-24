import { afterEach, beforeAll, expect, test } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Button } from '@pterodactyl/sdk';
import {
    createExtensionTestHost,
    preloadTheme,
    renderView,
    renderWithTheme,
    type ExtensionTestHost,
    type RenderedView,
} from '@pterodactyl/sdk/testing';
import { groupServerNav } from './lib/groups';
import { uptime, bytes } from './lib/format';
import theme from './theme';

const themes = [theme];
let rendered: RenderedView | undefined;
let host: ExtensionTestHost | undefined;

beforeAll(() => preloadTheme(themes));
afterEach(() => {
    rendered?.unmount();
    host?.dispose();
    host = undefined;
});

const signedIn = () => (host = createExtensionTestHost());

test('frames every signed-in page in the sidebar shell with the switcher and Quickcast', () => {
    rendered = renderView('layout.app', { themes, fixture: 'admin' });

    const container = rendered.container;
    expect(container.querySelector('[data-obsidian-layout] main')).not.toBeNull();
    expect(container.querySelector('#obsidian-sidebar')).not.toBeNull();
    expect(screen.getByRole('link', { name: /All servers/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /All servers/ }).getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.getByRole('button', { name: 'Quickcast' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).not.toBeNull();
});

test('groups a server area into sections under the server card', () => {
    rendered = renderView('layout.app', { themes, fixture: 'serverArea' });

    const server = screen.getByRole('navigation', { name: 'Server' });
    expect(within(server).getByRole('button', { name: /Basic/ })).not.toBeNull();
    expect(within(server).getByRole('link', { name: /Console/ })).not.toBeNull();

    expect(screen.getByRole('button', { name: 'Restart' })).not.toBeNull();
});

test('files core pages by id and extension screens by their own group', () => {
    const item = (id: string, group: string | null = null, extensionId?: string) => ({
        id,
        label: id,
        destination: { to: '/' } as never,
        icon: null,
        group,
        order: 0,
        exact: false,
        extensionId,
    });
    const groups = groupServerNav([
        item('startup'),
        item('index'),
        item('versions', 'Minecraft', 'versions'),
        item('backups'),
        item('mystery', null, 'mystery'),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['Basic', 'Minecraft', 'Tools', 'Configuration', 'Extensions']);
});

test('lists the dashboard servers as rows that link to each server', () => {
    signedIn();
    rendered = renderView('dashboard.serverList', { themes, fixture: 'servers' });

    expect(screen.getByRole('link', { name: 'Survival' }).getAttribute('href')).toBe('/server/a1b2c3d4');
    expect(screen.getByRole('tablist', { name: 'Filter servers' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: /Good .*, Alex/ })).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'Find a server' })).not.toBeNull();
});

test('draws a running server card with gauges and a stop button', () => {
    rendered = renderView('dashboard.serverCard', { themes, fixture: 'running' });

    expect(rendered.container.textContent).toContain('CPU');
    expect(rendered.container.textContent).toContain('Memory');
    expect(screen.getByRole('button', { name: /^Stop / })).not.toBeNull();
});

test('places the terminal, live tiles and graphs on the console', () => {
    rendered = renderView('page.server.console', { themes });

    expect(screen.getByRole('textbox', { name: 'Console command' })).not.toBeNull();
    expect(rendered.container.textContent).toContain('Address');
});

test('keeps the engine field attributes on the sign-in form', () => {
    rendered = renderView('page.auth.login', { themes, fixture: 'invalid' });

    const password = screen.getByLabelText('Password');
    expect(password.getAttribute('autocomplete')).toBe('current-password');
    expect(password.getAttribute('aria-invalid')).toBe('true');
});

test('describes each account setting beside its form', () => {
    signedIn();
    rendered = renderView('page.account.overview', { themes });

    expect(screen.getByRole('heading', { name: 'Password' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Email address' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Two-step verification' })).not.toBeNull();
    expect(screen.getByText('Two-step off')).not.toBeNull();
});

test('draws buttons as pills and keeps their state attributes', () => {
    rendered = renderWithTheme(<Button color='red'>Save</Button>, { themes });

    const button = rendered.container.querySelector('button');
    expect(button?.className).toContain('rounded-full');
    expect(button?.dataset).toMatchObject({ ui: 'button', part: 'root', color: 'red' });
});

test('formats uptime and sizes compactly', () => {
    expect(uptime((3 * 86400 + 7 * 3600) * 1000)).toBe('3d 7h');
    expect(uptime(52_000)).toBe('52s');
    expect(bytes(2.66 * 1024 ** 3)).toBe('2.66 GiB');
    expect(bytes(0)).toBe('0 B');
});
