import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleCheck, ExternalLink, FileWarning, RefreshCw, Share2, Sparkles, Stethoscope } from 'lucide-react';
import { Alert, Badge, Button, PanelLink, Spinner, cn, fromNow, http, toast } from '@pterodactyl/sdk';
import { analyseLog, diagnose, shareLog, tail, type Analysis, type Finding } from '../lib/doctor';
import { useToolkit } from '../lib/useToolkit';
import Page, { Eyebrow, Panel, Segmented } from '../ui/Page';

type Source = 'log' | 'crash' | 'console';

const tone = { critical: 'danger', warning: 'warning', info: 'info' } as const;

interface Sources {
    readonly log: string | null;
    readonly crash: { name: string; text: string; at: string } | null;
    readonly console: string | null;
}

/** latest.log's tail, the newest crash report, and Wings' recent console lines. */
function useSources() {
    const { id, api } = useToolkit();
    return useQuery({
        queryKey: ['obsidian-mc', id, 'doctor'],
        queryFn: async (): Promise<Sources> => {
            const [log, reports, consoleLines] = await Promise.all([
                api.readOrNull('/logs/latest.log'),
                api.listOrEmpty('/crash-reports'),
                http
                    .get<{ attributes: { lines: string[] } }>(`/api/client/servers/${id}/logs`, { params: { lines: 100 } })
                    .then((r) => r.data.attributes.lines.join('\n'))
                    .catch(() => null),
            ]);
            const newest = reports
                .filter((e) => e.isFile && e.name.endsWith('.txt'))
                .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))[0];
            const crash = newest ? await api.readOrNull(`/crash-reports/${newest.name}`) : null;

            return {
                log: log === null ? null : tail(log, 3000),
                crash: newest && crash ? { name: newest.name, text: crash, at: newest.modifiedAt } : null,
                console: consoleLines,
            };
        },
        staleTime: 30_000,
    });
}

function FindingCard({ finding, id }: { finding: Finding; id: string }) {
    return (
        <li className='rounded-xl border border-border bg-card'>
            <div className='flex flex-wrap items-start gap-3 p-4'>
                <Badge tone={tone[finding.severity]} variant='soft' size='sm'>
                    {finding.severity}
                </Badge>
                <div className='min-w-0 flex-1 basis-64'>
                    <h3 className='font-bold tracking-tight'>{finding.title}</h3>
                    <p className='mt-1 text-sm text-muted-foreground'>{finding.cause}</p>
                    <ol className='mt-3 flex list-decimal flex-col gap-1 pl-5 text-sm'>
                        {finding.fixes.map((fix) => (
                            <li key={fix}>{fix}</li>
                        ))}
                    </ol>
                </div>
                {finding.page && (
                    <PanelLink
                        destination={{ to: `/server/$id/mc/${finding.page}` as '/server/$id', params: { id } }}
                        className='flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground no-underline hover:bg-muted'
                    >
                        Fix it <ArrowRight className='size-3.5' aria-hidden />
                    </PanelLink>
                )}
            </div>
            <pre className='overflow-x-auto rounded-b-xl border-t border-border bg-terminal px-4 py-3 font-mono text-[0.72rem] leading-relaxed text-terminal-foreground'>
                {finding.lines.join('\n')}
            </pre>
        </li>
    );
}

/** Reads the latest log and crash report, explains what went wrong, and links to the page that fixes it. */
export default function DoctorScreen() {
    const { id } = useToolkit();
    const sources = useSources();
    const [source, setSource] = useState<Source>('log');
    const [shared, setShared] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [busy, setBusy] = useState<'share' | 'analyse' | null>(null);

    const text =
        source === 'crash' ? (sources.data?.crash?.text ?? null) : source === 'console' ? (sources.data?.console ?? null) : (sources.data?.log ?? null);
    const findings = text ? diagnose(text) : [];

    const share = async () => {
        if (!text) return;
        setBusy('share');
        try {
            setShared(await shareLog(text));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Sharing failed.');
        }
        setBusy(null);
    };

    const analyse = async () => {
        if (!text) return;
        setBusy('analyse');
        try {
            setAnalysis(await analyseLog(text));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Analysis failed.');
        }
        setBusy(null);
    };

    return (
        <Page
            title='Crash doctor'
            description='Reads your logs and crash reports and tells you what went wrong, in plain words.'
            actions={
                <Button color='grey' onClick={() => void sources.refetch()} isLoading={sources.isFetching}>
                    <RefreshCw className='size-4' aria-hidden /> Re-check
                </Button>
            }
        >
            <div className='flex flex-wrap items-center gap-3'>
                <Segmented
                    label='What to read'
                    value={source}
                    onChange={(value) => {
                        setSource(value);
                        setShared(null);
                        setAnalysis(null);
                    }}
                    options={[
                        { value: 'log', label: 'latest.log' },
                        { value: 'crash', label: 'Crash report' },
                        { value: 'console', label: 'Console' },
                    ]}
                />
                {source === 'crash' && sources.data?.crash && (
                    <span className='text-xs text-muted-foreground'>
                        {sources.data.crash.name} · {fromNow(sources.data.crash.at)}
                    </span>
                )}
            </div>

            {sources.isLoading && <Spinner size='large' centered />}
            {!sources.isLoading && !text && (
                <Alert type='info'>
                    {source === 'crash' ? 'No crash reports. The server has not crashed hard.' : 'Nothing to read yet. Start the server once.'}
                </Alert>
            )}

            {text && (
                <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]'>
                    <div className='min-w-0'>
                        {findings.length === 0 ? (
                            <div className='flex items-center gap-4 rounded-xl border border-border bg-card p-5'>
                                <span className='grid size-11 place-items-center rounded-xl bg-success/12 text-success'>
                                    <CircleCheck className='size-5' aria-hidden />
                                </span>
                                <div>
                                    <p className='font-bold'>No known problems found</p>
                                    <p className='text-sm text-muted-foreground'>
                                        Nothing in this {source === 'crash' ? 'report' : 'log'} matches a problem the doctor knows. Try a deep analysis.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <Eyebrow className='mb-3'>
                                    {findings.length} finding{findings.length === 1 ? '' : 's'}
                                </Eyebrow>
                                <ul className='flex flex-col gap-3'>
                                    {findings.map((finding) => (
                                        <FindingCard key={finding.id} finding={finding} id={id} />
                                    ))}
                                </ul>
                            </>
                        )}
                        {analysis && (
                            <Panel title='Deep analysis (mclo.gs)' className='mt-6'>
                                {analysis.problems.length === 0 && <p className='text-sm text-muted-foreground'>mclo.gs found no problems either.</p>}
                                <ul className='flex flex-col gap-3'>
                                    {analysis.problems.map((p, i) => (
                                        <li key={i} className='text-sm'>
                                            <p className='font-semibold'>{p.message}</p>
                                            <ul className='mt-1 list-disc pl-5 text-muted-foreground'>
                                                {p.solutions.map((s, j) => (
                                                    <li key={j}>{s.message}</li>
                                                ))}
                                            </ul>
                                        </li>
                                    ))}
                                </ul>
                                {analysis.information.length > 0 && (
                                    <dl className='mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs'>
                                        {analysis.information.map((info) => (
                                            <div key={info.label} className='contents'>
                                                <dt className='text-muted-foreground'>{info.label}</dt>
                                                <dd className='truncate font-mono'>{info.value}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                            </Panel>
                        )}
                    </div>
                    <div className='flex flex-col gap-4'>
                        <Panel title='Get more help' aside={<Stethoscope className='size-4 text-muted-foreground' aria-hidden />}>
                            <p className='text-sm text-muted-foreground'>
                                These send this {source === 'crash' ? 'report' : 'log'} to mclo.gs, a public log host. It leaves the panel and may include
                                player names and IP addresses.
                            </p>
                            <div className='mt-4 flex flex-col gap-2'>
                                <Button color='grey' onClick={analyse} isLoading={busy === 'analyse'} disabled={busy !== null}>
                                    <Sparkles className='size-4' aria-hidden /> Deep analysis
                                </Button>
                                <Button color='grey' onClick={share} isLoading={busy === 'share'} disabled={busy !== null}>
                                    <Share2 className='size-4' aria-hidden /> Share log
                                </Button>
                            </div>
                            {shared && (
                                <a
                                    href={shared}
                                    target='_blank'
                                    rel='noreferrer'
                                    className='mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 font-mono text-xs text-foreground no-underline hover:bg-muted'
                                >
                                    <span className='min-w-0 flex-1 truncate'>{shared}</span>
                                    <ExternalLink className='size-3.5 shrink-0' aria-hidden />
                                </a>
                            )}
                        </Panel>
                        <Panel title='Read'>
                            <p className={cn('flex items-center gap-2 text-sm', !text && 'text-muted-foreground')}>
                                <FileWarning className='size-4 text-muted-foreground' aria-hidden />
                                {text.split('\n').length.toLocaleString()} lines
                            </p>
                        </Panel>
                    </div>
                </div>
            )}
        </Page>
    );
}
