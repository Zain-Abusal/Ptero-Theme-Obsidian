import { expect, test } from 'vitest';
import { diagnose } from './lib/doctor';
import { MAX_OFFSET, cronFor, planRestart, spell } from './lib/schedules';
import { asideName, groupWorlds, worldCandidates } from './lib/worlds';
import { applyChanges, leaves, parseYaml, pathKey } from './lib/yaml-config';
import { highlight, levelOf, plainLine } from './lib/ops-logs';

test('plans countdown warnings before a restart', () => {
    const plan = planRestart([600, 300, 60, 10], 'Restarting in {time}!');

    expect(plan.lead).toBe(600);
    expect(plan.tasks).toEqual([
        { action: 'command', payload: 'say Restarting in 10 minutes!', time_offset: 0 },
        { action: 'command', payload: 'say Restarting in 5 minutes!', time_offset: 300 },
        { action: 'command', payload: 'say Restarting in 1 minute!', time_offset: 240 },
        { action: 'command', payload: 'say Restarting in 10 seconds!', time_offset: 50 },
        { action: 'power', payload: 'restart', time_offset: 10 },
    ]);
    // The offsets add up to the lead: the restart lands exactly on time.
    expect(plan.tasks.reduce((sum, t) => sum + t.time_offset, 0)).toBe(plan.lead);
});

test('rounds the lead up to a whole minute and waits the leftover first', () => {
    const plan = planRestart([90, 30], '{time}');

    expect(plan.lead).toBe(120);
    expect(plan.tasks[0]).toMatchObject({ payload: 'say 1 minute 30 seconds', time_offset: 30 });
    expect(plan.tasks.reduce((sum, t) => sum + t.time_offset, 0)).toBe(120);
});

test('never asks the panel to wait more than 900 seconds between tasks', () => {
    const plan = planRestart([3600, 60], 'in {time}');

    expect(plan.tasks.every((t) => t.time_offset <= MAX_OFFSET)).toBe(true);
    expect(plan.tasks.reduce((sum, t) => sum + t.time_offset, 0)).toBe(3600);
    expect(plan.tasks.map((t) => t.payload)).toContain('say in 45 minutes');
    // A lone long warning still reaches the restart in steps of at most 900 seconds.
    expect(planRestart([1800], 'x').tasks.every((t) => t.time_offset <= MAX_OFFSET)).toBe(true);
    // No warnings: restart straight away.
    expect(planRestart([], 'x')).toEqual({ lead: 0, tasks: [{ action: 'power', payload: 'restart', time_offset: 0 }] });
});

test('moves the days back when the warnings start before midnight', () => {
    expect(cronFor('04:00', [], 600)).toEqual({ minute: '50', hour: '3', day_of_week: '*' });
    expect(cronFor('00:05', [1, 3], 600)).toEqual({ minute: '55', hour: '23', day_of_week: '0,2' });
    expect(cronFor('00:00', [0], 60)).toEqual({ minute: '59', hour: '23', day_of_week: '6' });
    expect(spell(61)).toBe('1 minute 1 second');
});

test('finds the Java a server needs from an UnsupportedClassVersionError', () => {
    const [finding] = diagnose(
        'Exception in thread "main" java.lang.UnsupportedClassVersionError: io/papermc/paperclip/Main has been compiled by a more recent version of the Java Runtime (class file version 65.0), this version of the Java Runtime only recognizes class file versions up to 61.0'
    );

    expect(finding).toMatchObject({
        id: 'java-version',
        severity: 'critical',
        title: 'Needs Java 21, running Java 17',
        page: 'versions',
    });
});

test('reads several problems from one log, critical first', () => {
    const log = [
        '[12:00:00 INFO]: Starting minecraft server version 1.21.4',
        "[12:00:01 ERROR]: Could not load 'plugins/Shop.jar' in folder 'plugins'",
        'org.bukkit.plugin.UnknownDependencyException: Unknown/missing dependency plugins: [Vault]',
        '[12:00:02 ERROR]: Error occurred while enabling Essentials (Is it up to date?)',
        '[12:00:03 WARN]: **** FAILED TO BIND TO PORT!',
        '[12:00:03 WARN]: The exception was: java.net.BindException: Address already in use',
    ].join('\n');
    const findings = diagnose(log);

    expect(findings.map((f) => f.id)).toEqual(['port', 'dependency', 'plugin-enable', 'plugin-load']);
    expect(findings.find((f) => f.id === 'dependency')?.title).toBe('Missing plugin: Vault');
    expect(findings.find((f) => f.id === 'plugin-enable')?.title).toBe('Essentials failed to start');
    expect(findings[0].lines.join('\n')).toContain('FAILED TO BIND TO PORT');
    expect(diagnose('[12:00:00 INFO]: Done (4.2s)! For help, type "help"')).toEqual([]);
});

test('spots the EULA, memory, freezes, Fabric and duplicate jars', () => {
    const ids = (text: string) => diagnose(text).map((f) => f.id);

    expect(ids('[ServerMain/INFO]: You need to agree to the EULA in order to run the server.')).toEqual(['eula']);
    expect(ids('java.lang.OutOfMemoryError: Java heap space')).toEqual(['memory']);
    expect(
        ids('[Watchdog Thread/ERROR]: The server has stopped responding! This is (probably) not a Paper bug.')
    ).toEqual(['watchdog']);
    expect(ids('net.fabricmc.loader.impl.FormattedException: Mod resolution failed')).toEqual(['fabric']);
    expect(
        ids("[Server thread/ERROR]: Ambiguous plugin name `LuckPerms' for files `plugins/a.jar' and `plugins/b.jar'")
    ).toEqual(['duplicate']);
    expect(ids('Error: Unable to access jarfile server.jar')).toEqual(['jar-missing']);
});

test('opens only plausible world folders, likely names first', () => {
    const entry = (name: string, isFile = false) => ({ name, isFile, size: 0, modifiedAt: '' });
    const root = [
        entry('plugins'),
        entry('logs'),
        entry('world_nether'),
        entry('lobby'),
        entry('world'),
        entry('.cache'),
        entry('server.jar', true),
        entry('survival'),
    ];

    expect(worldCandidates(root, 'survival')).toEqual(['survival', 'world', 'world_nether', 'lobby']);
    expect(groupWorlds(['survival', 'world', 'world_nether', 'world_the_end', 'lobby'])).toEqual([
        { name: 'survival', dimensions: [] },
        { name: 'world', dimensions: ['nether', 'the_end'] },
        { name: 'lobby', dimensions: [] },
    ]);
    // A lone Nether folder without its base world still shows.
    expect(groupWorlds(['old_nether'])).toEqual([{ name: 'old_nether', dimensions: [] }]);
    expect(asideName('world', new Date('2026-11-24T10:00:00Z'))).toBe('world-old-2026-11-24');
});

test('edits YAML values and keeps every comment', () => {
    const text = [
        '# This is the main configuration file for Bukkit.',
        'settings:',
        '  allow-end: true # the End',
        '  warn-on-overload: true',
        '  connection-throttle: 4000',
        'spawn-limits:',
        '  monsters: 70',
        'aliases: now-in-commands.yml',
        '',
    ].join('\n');
    const doc = parseYaml(text);
    const found = leaves(doc);

    expect(found.map((l) => pathKey(l.path).replace(/\u0000/g, '.'))).toEqual([
        'settings.allow-end',
        'settings.warn-on-overload',
        'settings.connection-throttle',
        'spawn-limits.monsters',
        'aliases',
    ]);
    expect(found[0]).toMatchObject({ section: 'settings', value: true });

    const out = applyChanges(
        text,
        new Map([
            ['a', { path: ['settings', 'allow-end'], value: false }],
            ['b', { path: ['spawn-limits', 'monsters'], value: 50 }],
        ])
    );
    expect(out).toContain('# This is the main configuration file for Bukkit.');
    expect(out).toContain('allow-end: false # the End');
    expect(out).toContain('monsters: 50');
    expect(out).toContain('connection-throttle: 4000');
});

test('classifies and highlights console lines', () => {
    expect(levelOf("[12:00:00 WARN]: Can't keep up!")).toBe('warn');
    expect(levelOf('[12:00:00 ERROR]: boom')).toBe('error');
    expect(levelOf('\tat net.minecraft.server.Main.main(Main.java:1)')).toBe('error');
    expect(levelOf('[12:00:00 INFO]: Done')).toBe('info');
    expect(plainLine('\x1b[33m§aHello\x1b[0m')).toBe('Hello');
    expect(highlight('Alex joined, alex left', 'alex')).toEqual([
        { text: 'Alex', match: true },
        { text: ' joined, ', match: false },
        { text: 'alex', match: true },
        { text: ' left', match: false },
    ]);
});

test('console tools render inside a server page and filter the buffered output', async () => {
    const { render, screen, fireEvent, act } = await import('@testing-library/react');
    const { createElement } = await import('react');
    const { createExtensionTestHost, createTestServer } = await import('@pterodactyl/sdk/testing');
    const { default: ConsoleTools } = await import('../views/console/ConsoleTools');

    const server = createTestServer({ identifier: 'a1b2c3d4' });
    const host = createExtensionTestHost({ server });
    const overlay = document.createElement('div');
    document.body.append(overlay);
    const command = {
        allowed: true,
        disabled: false,
        value: '',
        history: ['list'],
        setValue: () => undefined,
        previous: () => undefined,
        next: () => undefined,
        submit: () => undefined,
    };

    const view = render(createElement(host.Wrapper, null, createElement(ConsoleTools, { server, command, overlay })));
    // The host mounts its router asynchronously; listen only once the tools are on screen.
    await screen.findByRole('button', { name: 'Warnings' });
    await act(async () => {
        host.emitWebsocket('console output', "[12:00:00 INFO]: Done\n[12:00:01 WARN]: Can't keep up!");
        await new Promise((resolve) => setTimeout(resolve, 150));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Warnings' }));
    const log = screen.getByRole('log', { name: 'Filtered console' });
    expect(overlay.contains(log)).toBe(true);
    expect(log.textContent).toContain("Can't keep up!");
    expect(log.textContent).not.toContain('Done');
    expect(screen.getByRole('button', { name: 'Copy console output' }).hasAttribute('disabled')).toBe(false);

    view.unmount();
    host.dispose();
    overlay.remove();
}, 30_000);
