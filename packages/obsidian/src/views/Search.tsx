import { CornerDownLeft, Search as SearchIcon, SearchX } from 'lucide-react';
import { Dialog, InputSpinner, NamedIcon, PanelLink, cn } from '@pterodactyl/sdk';
import { useNavigation, type AppSearchModel, type ViewProps } from '@pterodactyl/sdk/theme';

const row =
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground no-underline hover:bg-muted focus-visible:bg-muted focus-visible:outline-none';

/** Account pages that match the term, so Quickcast also jumps around the panel, not only to servers. */
function Pages({ model }: { model: AppSearchModel }) {
    const { items } = useNavigation('account');
    const term = model.field.fieldProps.value.trim().toLowerCase();
    const matches = items.filter((item) => !term || item.label.toLowerCase().includes(term));

    if (matches.length === 0) return null;

    return (
        <div>
            <p className='obs-eyebrow px-3 pt-3 pb-1.5 text-[0.6rem]'>Pages</p>
            {matches.map((item) => (
                <PanelLink key={item.id} destination={item.destination} onClick={model.close} className={row}>
                    {item.icon && <NamedIcon name={item.icon} size={16} className='text-muted-foreground' aria-hidden />}
                    <span className='flex-1'>{item.label}</span>
                </PanelLink>
            ))}
        </div>
    );
}

function Servers({ model }: { model: AppSearchModel }) {
    if (model.error) return <p className='px-3 py-4 text-sm text-destructive'>{model.error}</p>;

    if (model.searched && model.results.length === 0) {
        return (
            <div className='flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-muted-foreground'>
                <SearchX className='size-5' aria-hidden />
                No servers match that name, address or UUID.
            </div>
        );
    }

    if (model.results.length === 0) return null;

    return (
        <div>
            <p className='obs-eyebrow px-3 pt-3 pb-1.5 text-[0.6rem]'>Servers</p>
            {model.results.map((result) => (
                <PanelLink key={result.uuid} destination={result.destination} onClick={model.close} className={row}>
                    <span className='min-w-0 flex-1'>
                        <span className='block truncate font-semibold'>{result.name}</span>
                        <span className='block truncate font-mono text-xs text-muted-foreground'>
                            {result.addresses.join(', ') || result.identifier}
                        </span>
                    </span>
                    <span className='rounded-full border border-border px-2 py-0.5 text-[0.68rem] text-muted-foreground'>
                        {result.node}
                    </span>
                    <CornerDownLeft className='size-3.5 text-muted-foreground' aria-hidden />
                </PanelLink>
            ))}
        </div>
    );
}

/** Quickcast: the panel's own search, as a pill in the top bar and a command palette. */
export default function Search({ model, className }: ViewProps<'app.search'>) {
    const { fieldProps } = model.field;

    return (
        <>
            {model.open && (
                <Dialog title='Quickcast' open onClose={model.close}>
                    <form noValidate onSubmit={(event) => event.preventDefault()} className='-mx-2'>
                        <InputSpinner visible={model.loading}>
                            <label className='flex items-center gap-3 rounded-xl border border-input-border bg-input px-3'>
                                <SearchIcon className='size-4 text-muted-foreground' aria-hidden />
                                <input
                                    {...fieldProps}
                                    autoFocus
                                    aria-label='Search servers and pages'
                                    aria-invalid={model.field.error ? true : undefined}
                                    placeholder='Search servers, addresses and pages…'
                                    className='h-11 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0'
                                />
                            </label>
                        </InputSpinner>
                        {model.field.error && <p className='mt-2 px-1 text-xs text-muted-foreground'>{model.field.error}</p>}
                        <div className='mt-2 max-h-[55vh] overflow-y-auto'>
                            <Servers model={model} />
                            <Pages model={model} />
                        </div>
                    </form>
                </Dialog>
            )}
            <button
                type='button'
                aria-label='Quickcast'
                aria-keyshortcuts={model.shortcut.aria}
                onClick={model.show}
                className={cn(
                    'flex h-10 items-center gap-2.5 rounded-full border border-border bg-card/80 px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground sm:min-w-56',
                    className
                )}
            >
                <SearchIcon className='size-4' aria-hidden />
                <span className='hidden flex-1 text-left sm:inline'>Quickcast</span>
                <kbd className='obs-kbd hidden sm:inline-flex'>{model.shortcut.label}</kbd>
            </button>
        </>
    );
}
