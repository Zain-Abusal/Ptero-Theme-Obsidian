import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Download, KeyRound, Network, Vote } from 'lucide-react';
import { Alert, Badge, Button, PanelLink, Spinner, cn, http, toast } from '@pterodactyl/sdk';
import { githubDownload } from '../lib/kits';
import { looksInstalled } from '../lib/sources';
import { useDirectory, useToolkit } from '../lib/useToolkit';
import Page, { Panel, Step, attempt } from '../ui/Page';

const CONFIG = '/plugins/Votifier/config.yml';
const PUBLIC_KEY = '/plugins/Votifier/rsa/public.key';

interface Allocation {
    readonly ip: string;
    readonly alias: string | null;
    readonly port: number;
    readonly primary: boolean;
}

export function readVotifierConfig(yaml: string): { port: number | null; token: string | null } {
    const port = /^port:\s*(\d+)/m.exec(yaml)?.[1];
    const token = /^tokens:\s*\n(?:\s+#.*\n)*\s+default:\s*['"]?([^'"\s]+)/m.exec(yaml)?.[1];
    return { port: port ? Number(port) : null, token: token ?? null };
}

export const setVotifierPort = (yaml: string, port: number) =>
    /^port:\s*\d+/m.test(yaml) ? yaml.replace(/^port:\s*\d+/m, `port: ${port}`) : `port: ${port}\n${yaml}`;

function Copyable({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className='flex flex-col gap-1.5'>
            <span className='text-xs font-semibold text-muted-foreground'>{label}</span>
            <button
                type='button'
                onClick={() =>
                    navigator.clipboard?.writeText(value).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                    })
                }
                className='flex items-start gap-2 rounded-lg border border-dashed border-border bg-background/50 px-3 py-2.5 text-left hover:bg-muted'
            >
                <span className={cn('min-w-0 flex-1 text-sm break-all', mono && 'font-mono text-xs')}>{value}</span>
                {copied ? (
                    <Check className='size-4 shrink-0 text-success' aria-label='Copied' />
                ) : (
                    <Copy className='size-4 shrink-0 text-muted-foreground' aria-label='Copy' />
                )}
            </button>
        </div>
    );
}

export default function VotifierScreen() {
    const { id, api } = useToolkit();
    const client = useQueryClient();
    const plugins = useDirectory('/plugins');
    const names = (plugins.data ?? []).map((e) => e.name);
    const installed = looksInstalled(names, 'nuvotifier', 'votifier');
    const [busy, setBusy] = useState(false);

    const files = useQuery({
        queryKey: ['obsidian-mc', id, 'votifier'],
        queryFn: async () => ({ config: await api.readOrNull(CONFIG), key: await api.readOrNull(PUBLIC_KEY) }),
        enabled: installed,
    });
    const allocations = useQuery({
        queryKey: ['obsidian-mc', id, 'allocations'],
        queryFn: async () => {
            const { data } = await http.get<{
                data: { attributes: { ip: string; ip_alias: string | null; port: number; is_default: boolean } }[];
            }>(`/api/client/servers/${id}/network/allocations`);
            return data.data.map(({ attributes: a }): Allocation => ({
                ip: a.ip,
                alias: a.ip_alias,
                port: a.port,
                primary: a.is_default,
            }));
        },
    });

    const config = files.data?.config ? readVotifierConfig(files.data.config) : null;
    const primary = allocations.data?.find((a) => a.primary);
    const spare = allocations.data?.filter((a) => !a.primary) ?? [];
    const host = primary ? primary.alias || primary.ip : '…';
    const portUsable =
        config?.port !== null && config?.port !== undefined && allocations.data?.some((a) => a.port === config.port);

    const install = async () => {
        setBusy(true);
        await attempt(
            async () => {
                const file = await githubDownload('NuVotifier/NuVotifier', /nuvotifier.*\.jar$/i);
                await api.mkdir('/', 'plugins').catch(() => undefined);
                await api.pull(file.url, '/plugins', file.filename);
            },
            'NuVotifier installed. Restart the server once so it writes its config and keys.',
            toast
        );
        await client.invalidateQueries({ queryKey: ['obsidian-mc', id] });
        setBusy(false);
    };

    const usePort = async (port: number) => {
        if (!files.data?.config) return;
        setBusy(true);
        await attempt(
            () => api.write(CONFIG, setVotifierPort(files.data!.config!, port)),
            `Votifier now listens on ${port}. Restart to apply.`,
            toast
        );
        await client.invalidateQueries({ queryKey: ['obsidian-mc', id, 'votifier'] });
        setBusy(false);
    };

    return (
        <Page title='Votifier' description='Reward players for voting on server lists.'>
            {plugins.isLoading ? (
                <Spinner size='large' centered />
            ) : !installed ? (
                <div className='flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center'>
                    <span className='grid size-14 place-items-center rounded-2xl border border-border bg-muted'>
                        <Vote className='size-6' aria-hidden />
                    </span>
                    <div>
                        <h2 className='text-xl font-bold'>NuVotifier is not installed</h2>
                        <p className='mx-auto mt-1 max-w-md text-sm text-muted-foreground'>
                            Voting sites tell your server about votes through NuVotifier. Install it, restart once, and
                            come back here to finish.
                        </p>
                    </div>
                    <Button onClick={install} isLoading={busy} disabled={busy}>
                        <Download className='size-4' aria-hidden /> Install NuVotifier
                    </Button>
                </div>
            ) : files.isLoading ? (
                <Spinner size='large' centered />
            ) : !files.data?.config ? (
                <Alert type='info'>
                    NuVotifier is installed. Restart the server once so it creates its config and keys, then reload this
                    page.
                </Alert>
            ) : (
                <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]'>
                    <div className='flex flex-col gap-6'>
                        <Panel
                            title='What voting sites ask for'
                            aside={
                                <Badge tone='success' variant='soft'>
                                    Installed
                                </Badge>
                            }
                        >
                            <div className='grid gap-4 sm:grid-cols-2'>
                                <Copyable label='Server address' value={host} />
                                <Copyable label='Votifier port' value={String(config?.port ?? '-')} />
                            </div>
                            {files.data.key && (
                                <div className='mt-4'>
                                    <Copyable
                                        label='Public key (v1 sites)'
                                        value={files.data.key.replace(/-----[^-]+-----|\s/g, '')}
                                    />
                                </div>
                            )}
                            {config?.token && (
                                <div className='mt-4'>
                                    <Copyable label='Token (v2 sites)' value={config.token} />
                                </div>
                            )}
                        </Panel>
                        <Panel title='Set it up'>
                            <Step n={1}>Give Votifier its own port</Step>
                            <p className='mb-5 text-sm text-muted-foreground'>
                                Assign an extra port in the panel&apos;s Network page, then select it from the list.
                            </p>
                            <Step n={2}>Add the server on each voting site</Step>
                            <p className='mb-5 text-sm text-muted-foreground'>
                                Paste the address, the Votifier port and the public key or token where the site asks for
                                them.
                            </p>
                            <Step n={3}>Reward votes</Step>
                            <p className='text-sm text-muted-foreground'>
                                Votifier only receives votes. Pair it with a rewards plugin from the Plugins page, such
                                as VotingPlugin or SuperbVote.
                            </p>
                        </Panel>
                    </div>
                    <Panel title='Port' aside={<Network className='size-4 text-muted-foreground' aria-hidden />}>
                        {!portUsable && (
                            <p className='mb-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning'>
                                Port {config?.port ?? '?'} is not one of this server's allocations, so voting sites
                                cannot reach it.
                            </p>
                        )}
                        {allocations.isLoading && <Spinner centered />}
                        {spare.length === 0 && !allocations.isLoading && (
                            <p className='text-sm text-muted-foreground'>
                                This server has only its game port. Add an allocation on the Network page, then pick it
                                here.{' '}
                                <PanelLink
                                    destination={{ to: '/server/$id/network' as '/server/$id', params: { id } }}
                                    className='font-semibold underline'
                                >
                                    Open Network
                                </PanelLink>
                            </p>
                        )}
                        <ul className='flex flex-col gap-1.5'>
                            {spare.map((a) => (
                                <li key={a.port}>
                                    <button
                                        type='button'
                                        disabled={busy || a.port === config?.port}
                                        onClick={() => usePort(a.port)}
                                        className={cn(
                                            'flex w-full items-center justify-between rounded-lg border px-3 py-2 font-mono text-sm',
                                            a.port === config?.port
                                                ? 'border-success/50 bg-success/10'
                                                : 'border-border hover:bg-muted'
                                        )}
                                    >
                                        {a.alias || a.ip}:{a.port}
                                        {a.port === config?.port ? (
                                            <Check className='size-4 text-success' aria-label='In use' />
                                        ) : (
                                            <span className='font-sans text-xs text-muted-foreground'>Use</span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <p className='mt-4 flex items-start gap-2 text-xs text-muted-foreground'>
                            <KeyRound className='mt-0.5 size-3.5 shrink-0' aria-hidden />
                            Keys live in plugins/Votifier/rsa. Never share the private key.
                        </p>
                    </Panel>
                </div>
            )}
        </Page>
    );
}
