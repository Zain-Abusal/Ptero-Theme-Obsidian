import { expect, test } from 'vitest';
import { cleanCommands, moveCommand, normaliseCommand, STARTER_COMMANDS } from './commands';

test('cleans and limits saved quick commands', () => {
    expect(normaliseCommand('  /say hello  ')).toBe('say hello');
    expect(
        cleanCommands([
            { label: ' Save ', command: ' /save-all ', confirm: true },
            null,
            { label: '', command: 'stop' },
        ])
    ).toEqual([{ label: 'Save', command: 'save-all', confirm: true }]);
    expect(
        cleanCommands(Array.from({ length: 35 }, (_, i) => ({ label: `Command ${i}`, command: `say ${i}` })))
    ).toHaveLength(30);
});

test('moves quick commands within the available range', () => {
    expect(moveCommand(STARTER_COMMANDS, 0, 2).map((item) => item.label)).toEqual([
        'Who is on',
        'Whitelist on',
        'Save',
        'Whitelist off',
        'Clear weather',
        'Make it day',
    ]);
    expect(moveCommand(STARTER_COMMANDS, 0, -1)).toEqual(STARTER_COMMANDS);
});
