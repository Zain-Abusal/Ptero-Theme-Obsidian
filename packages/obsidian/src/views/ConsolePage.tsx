import { Alert, ServerContentBlock, cn } from '@pterodactyl/sdk';
import { Slot, View, type ServerConsoleModel, type ViewProps } from '@pterodactyl/sdk/theme';
import { useObsidian } from '../lib/settings';

const notices: Record<NonNullable<ServerConsoleModel['notice']>, string> = {
    maintenance: 'This node is under maintenance, so the server cannot be controlled right now.',
    installing: 'The server is installing; most actions wait until it finishes.',
    transferring: 'The server is moving to another node.',
};

/**
 * The console: a tall terminal first, live tiles under it, then the graphs. Power controls live in the
 * sidebar's server card, so they show here only where that card does not (small screens, or the
 * card turned off).
 */
export default function ConsolePage({ model, active }: ViewProps<'page.server.console'>) {
    const { sidebarServer } = useObsidian();

    return (
        <ServerContentBlock title={active ? 'Console' : undefined}>
            <div className={cn('mb-4 flex flex-wrap items-center gap-3', sidebarServer && 'lg:hidden')}>
                <div className='min-w-0 flex-1'>
                    <h1 className='truncate text-xl font-bold tracking-tight'>{model.name}</h1>
                    {model.description && <p className='truncate text-sm text-muted-foreground'>{model.description}</p>}
                </div>
                <View name='server.power' />
            </div>
            {model.notice && (
                <Alert type='warning' className='mb-4'>
                    {notices[model.notice]}
                </Alert>
            )}
            <Slot name='server.console.before' data={model.server} />
            <View name='server.terminal' className='h-[min(64vh,40rem)] min-h-80' />
            <View name='server.stats' className='mt-4' />
            <View name='server.graphs' className='mt-4 gap-4' />
            <Slot name='server.console.after' data={model.server} />
            {model.features.map((name) => (
                <View key={name} name={name} />
            ))}
        </ServerContentBlock>
    );
}
