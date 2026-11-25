import { expect, test } from 'vitest';
import { compareVersions, installerFor, latestBuilds, neoforgeMinecraft, parseMavenVersions } from './loaders';

test('parses Maven versions and keeps the newest supported Forge build per Minecraft version', () => {
    const versions = parseMavenVersions(
        '<metadata><versioning><versions><version>1.20.1-47.3.0</version><version>1.20.1-47.4.0</version><version>1.16.5-36.2.0</version></versions></versioning></metadata>'
    );

    expect(latestBuilds('forge', versions)).toEqual([{ minecraft: '1.20.1', loader: '47.4.0', stable: true }]);
    expect(compareVersions('47.10.0', '47.9.0')).toBeGreaterThan(0);
});

test('maps NeoForge releases to Minecraft versions and prefers stable builds', () => {
    expect(neoforgeMinecraft('21.4.85')).toBe('1.21.4');
    expect(neoforgeMinecraft('26.1.2')).toBe('26.1.2');
    expect(neoforgeMinecraft('craftmine')).toBeNull();
    expect(
        latestBuilds('neoforge', ['21.4.85', '21.4.99-beta', '21.1.92', '20.4.237']).find(
            (build) => build.minecraft === '1.21.4'
        )
    ).toEqual({ minecraft: '1.21.4', loader: '21.4.85', stable: true });
});

test('builds official installer asset URLs', () => {
    expect(installerFor('forge', { minecraft: '1.20.1', loader: '47.4.0' })).toEqual({
        url: 'https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.0/forge-1.20.1-47.4.0-installer.jar',
        filename: 'forge-1.20.1-47.4.0-installer.jar',
    });
    expect(installerFor('neoforge', { minecraft: '1.21.4', loader: '21.4.85' })).toEqual({
        url: 'https://maven.neoforged.net/releases/net/neoforged/neoforge/21.4.85/neoforge-21.4.85-installer.jar',
        filename: 'neoforge-21.4.85-installer.jar',
    });
});
