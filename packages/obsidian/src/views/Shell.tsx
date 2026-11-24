import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, LayoutGrid, LogOut, Menu, Moon, Paintbrush, Palette, Play, RotateCw, Shield, Square, Sun, Users, X } from 'lucide-react';
import { Avatar, DropdownMenu, NamedIcon, PanelLink, SpinnerOverlay, Tooltip, cn, toast, usePanelLocation } from '@pterodactyl/sdk';
import {
    Main,
    Navigation,
    NavigationLink,
    Slot,
    View,
    useNavigation,
    usePageTitle,
    type AppArea,
    type AppLayoutModel,
    type NavItem,
    type ServerArea,
    type ViewProps,
} from '@pterodactyl/sdk/theme';
import { groupServerNav } from '../lib/groups';
import { stateLabel, stateTone } from '../lib/format';
import { can, primaryAddress, sendPower, type PowerSignal } from '../lib/servers';
import { brandName, useObsidian } from '../lib/settings';
import { useRecent, useStored } from '../lib/storage';
import BrandMark from '../ui/BrandMark';
import Decor from '../ui/Decor';
import StatusDot from '../ui/StatusDot';
import ServerIcon from '../lib/serverIcon';
import Switcher from './Switcher';
import { useActiveIndicator } from '../lib/indicator';
import { SURFACES, useSurface, withTransition } from '../lib/surface';
import { defaultTint, useServerMeta } from '../lib/serverMeta';
import { usePlayerCount } from '../lib/players';

const CustomizeServer = lazy(() => import('./CustomizeServer'));

function Brand({ model }: { model: AppLayoutModel }) {
    const settings = useObsidian();
    const name = brandName(model.brand.name, settings);

    return (
        <PanelLink
            destination={{ to: '/' }}
            className='flex h-11 items-center gap-2.5 px-2 font-header text-[0.95rem] font-bold tracking-tight text-foreground no-underline'
        >
            {model.brand.logoUrl ? (
                <img src={model.brand.logoUrl} alt='' className='h-7 w-auto max-w-10 object-contain' />
            ) : (
                <BrandMark />
            )}
            <span className='truncate'>{name}</span>
        </PanelLink>
    );
}

/** A titled, collapsible run of links; the collapsed state is remembered per browser. */
function Group({ name, children }: { name: string; children: ReactNode }) {
    const [collapsed, setCollapsed] = useStored<string[]>('collapsed', []);
    const closed = collapsed.includes(name);

    return (
        <div className='flex flex-col gap-0.5'>
            <button
                type='button'
                aria-expanded={!closed}
                onClick={() => setCollapsed(closed ? collapsed.filter((g) => g !== name) : [...collapsed, name])}
                className='obs-eyebrow group mt-3 flex items-center justify-between rounded-md px-3 py-1.5 text-left text-[0.65rem] hover:text-foreground'
            >
                {name}
                <ChevronDown
                    className={cn('size-3 opacity-0 transition group-hover:opacity-100', closed && '-rotate-90 opacity-100')}
                    aria-hidden
                />
            </button>
            {!closed && children}
        </div>
    );
}

function NavList({ items }: { items: readonly NavItem[] }) {
    return (
        <Navigation items={items}>
            {(item, { badge }) => (
                <NavigationLink item={item} className='obs-nav-link'>
                    {item.icon && <NamedIcon name={item.icon} size={16} aria-hidden />}
                    <span className='min-w-0 flex-1 truncate'>{item.label}</span>
                    {badge}
                </NavigationLink>
            )}
        </Navigation>
    );
}

/** The slots an area layout renders around its navigation; Obsidian draws that navigation, so it renders them. */
function AreaSlot({ area, at }: { area: Exclude<AppArea, { kind: 'dashboard' }>; at: 'before' | 'after' }) {
    if (area.kind === 'server') return <Slot name={`server.navigation.${at}`} data={area.server} compact />;
    if (area.kind === 'account') return <Slot name={`account.navigation.${at}`} compact />;
    return <Slot name={`panel.navigation.${at}`} compact />;
}

function PowerButton({
    label,
    icon: Glyph,
    onClick,
    disabled,
    className,
}: {
    label: string;
    icon: typeof Play;
    onClick: () => void;
    disabled: boolean;
    className: string;
}) {
    return (
        <Tooltip content={label}>
            <button
                type='button'
                aria-label={label}
                disabled={disabled}
                onClick={onClick}
                className={cn(
                    'grid h-8 flex-1 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-35',
                    className
                )}
            >
                <Glyph className='size-3.5' aria-hidden />
            </button>
        </Tooltip>
    );
}

/** The server above its navigation: icon, name, address, live state and the power controls. */
function SidebarServer({ area }: { area: ServerArea }) {
    const [sending, setSending] = useState(false);
    const { server, state } = area;
    const running = state === 'running' || state === 'starting';
    const address = primaryAddress(server);

    const power = (signal: PowerSignal) => {
        setSending(true);
        sendPower(area.identifier, signal)
            .catch(() => toast.error(`Could not ${signal} the server.`))
            .finally(() => setSending(false));
    };

    const meta = useServerMeta(area.identifier);
    const tint = meta.color ?? defaultTint(area.uuid);
    const players = usePlayerCount(address, state === 'running');
    const [customizing, setCustomizing] = useState(false);

    return (
        <div
            className='obs-surface relative mt-1 flex flex-col gap-3 overflow-hidden p-3'
            style={{
                backgroundImage: `radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, ${tint} 14%, transparent), transparent 60%)`,
            }}
        >
            <div className='flex items-center gap-3'>
                <ServerIcon identifier={area.identifier} uuid={area.uuid} size={40} />
                <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-bold tracking-tight'>{area.name}</p>
                    {address && <p className='truncate font-mono text-[0.7rem] text-muted-foreground'>{address}</p>}
                </div>
                {can(server, 'file.update') && (
                    <Tooltip content='Customize'>
                        <button
                            type='button'
                            aria-label='Customize this server'
                            onClick={() => setCustomizing(true)}
                            className='grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground'
                        >
                            <Paintbrush className='size-3.5' aria-hidden />
                        </button>
                    </Tooltip>
                )}
            </div>
            <div className='flex items-center justify-between gap-2 text-[0.7rem]'>
                <span className='obs-eyebrow flex items-center gap-1.5 text-[0.65rem] text-foreground'>
                    <StatusDot tone={stateTone(state)} className={state === 'running' ? 'obs-live' : undefined} />
                    {state ? stateLabel[state] : 'Connecting'}
                </span>
                {players && (
                    <span className='obs-num flex items-center gap-1 font-medium text-muted-foreground'>
                        <Users className='size-3' aria-hidden />
                        {players.online}/{players.max}
                    </span>
                )}
                <Slot name='server.navigation.before' data={server} compact />
            </div>
            {customizing && (
                <Suspense fallback={null}>
                    <CustomizeServer server={server} onClose={() => setCustomizing(false)} />
                </Suspense>
            )}
            {area.conflict === null && (
                <div className='flex gap-1.5'>
                    <PowerButton
                        label='Start'
                        icon={Play}
                        disabled={sending || running || !can(server, 'control.start')}
                        onClick={() => power('start')}
                        className='bg-success/12 text-success hover:not-disabled:bg-success/20'
                    />
                    <PowerButton
                        label='Restart'
                        icon={RotateCw}
                        disabled={sending || state === 'offline' || !can(server, 'control.restart')}
                        onClick={() => power('restart')}
                        className='bg-warning/12 text-warning hover:not-disabled:bg-warning/20'
                    />
                    <PowerButton
                        label={state === 'stopping' ? 'Kill' : 'Stop'}
                        icon={Square}
                        disabled={sending || state === 'offline' || !can(server, 'control.stop')}
                        onClick={() => power(state === 'stopping' ? 'kill' : 'stop')}
                        className='bg-destructive/12 text-destructive hover:not-disabled:bg-destructive/20'
                    />
                </div>
            )}
        </div>
    );
}

/** Account links outside the server and admin areas, so they are always one click away. */
function AccountLinks() {
    const { items } = useNavigation('account');

    return <NavList items={items} />;
}

function Sidebar({ model }: { model: AppLayoutModel }) {
    const settings = useObsidian();
    const { area } = model;
    const { pathname } = usePanelLocation();
    const navs = useActiveIndicator<HTMLDivElement>([pathname, area.kind]);
    const tint = useServerMeta(area.kind === 'server' ? area.identifier : undefined).color;
    const admin = model.links.find((link) => link.id === 'admin');
    const serverItems = area.kind === 'server' && area.adminLink ? [...area.nav.items, area.adminLink] : null;

    return (
        <>
            <Brand model={model} />
            {area.kind === 'server' && settings.sidebarServer && <SidebarServer area={area} />}
            <div
                ref={navs}
                data-obs-indicated
                className='relative'
                style={area.kind === 'server' ? ({ '--obs-server-tint': tint ?? defaultTint(area.uuid) } as React.CSSProperties) : undefined}
            >
            <span className='obs-indicator' aria-hidden />
            <nav aria-label='Main' className='mt-3 flex flex-col gap-0.5'>
                <Slot name='nav.items.before' compact />
                <PanelLink destination={{ to: '/' }} exact className='obs-nav-link'>
                    <LayoutGrid aria-hidden />
                    All servers
                </PanelLink>
                {admin && (
                    <PanelLink destination={admin.destination} exact={admin.exact} className='obs-nav-link'>
                        <Shield aria-hidden />
                        {admin.label}
                    </PanelLink>
                )}
                <Slot name='nav.items.after' compact />
            </nav>
            {area.kind === 'server' ? (
                <nav aria-label='Server' className='flex flex-col'>
                    {!settings.sidebarServer && <AreaSlot area={area} at='before' />}
                    <AreaSlot area={area} at='after' />
                    {groupServerNav(serverItems ?? area.nav.items).map((group) => (
                        <Group key={group.name} name={group.name}>
                            <NavList items={group.items} />
                        </Group>
                    ))}
                </nav>
            ) : area.kind === 'admin' ? (
                <nav aria-label='Administration' className='flex flex-col'>
                    <AreaSlot area={area} at='before' />
                    <Group name='Administration'>
                        <NavList items={area.nav.items} />
                    </Group>
                    <AreaSlot area={area} at='after' />
                </nav>
            ) : (
                <nav aria-label='Account' className='flex flex-col'>
                    {area.kind === 'account' && <AreaSlot area={area} at='before' />}
                    <Group name='Account'>
                        <AccountLinks />
                    </Group>
                    {area.kind === 'account' && <AreaSlot area={area} at='after' />}
                </nav>
            )}
            </div>
        </>
    );
}

/** The surface library: each surface is a whole look in both schemes; the choice is kept per browser. */
function SurfaceMenu() {
    const [surface, setSurface] = useSurface();

    return (
        <DropdownMenu
            triggerClassName='grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground'
            triggerContent={
                <>
                    <Palette className='size-4' aria-hidden />
                    <span className='sr-only'>Surface</span>
                </>
            }
        >
            <DropdownMenu.Item checked={surface === null} onClick={() => setSurface(null)}>
                Panel default
            </DropdownMenu.Item>
            {SURFACES.map((s) => (
                <DropdownMenu.Item key={s.id} checked={surface === s.id} onClick={() => setSurface(s.id)}>
                    <span className='flex items-center gap-2.5'>
                        <span className='size-3.5 rounded-full border border-border' style={{ background: s.swatch }} />
                        {s.label}
                    </span>
                </DropdownMenu.Item>
            ))}
        </DropdownMenu>
    );
}

function UserCard({ model }: { model: AppLayoutModel }) {
    const { user, scheme, setScheme } = model;
    const SchemeIcon = scheme === 'dark' ? Sun : Moon;

    return (
        <div className='obs-surface flex items-center gap-2.5 p-2'>
            <PanelLink
                destination={{ to: '/account' }}
                className='flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 no-underline hover:bg-muted'
            >
                <Avatar name={user.uuid} image={user.avatar} size={30} />
                <span className='min-w-0'>
                    <span className='block truncate text-sm font-semibold text-foreground'>{user.username}</span>
                    <span className='block truncate text-[0.7rem] text-muted-foreground'>{user.email}</span>
                </span>
            </PanelLink>
            <SurfaceMenu />
            {setScheme && (
                <Tooltip content={scheme === 'dark' ? 'Light scheme' : 'Dark scheme'}>
                    <button
                        type='button'
                        aria-label={scheme === 'dark' ? 'Use the light scheme' : 'Use the dark scheme'}
                        onClick={(event) =>
                            withTransition(() => setScheme(scheme === 'dark' ? 'light' : 'dark'), {
                                x: event.clientX,
                                y: event.clientY,
                            })
                        }
                        className='grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground'
                    >
                        <SchemeIcon className='size-4 transition-transform duration-500 hover:rotate-45' aria-hidden />
                    </button>
                </Tooltip>
            )}
            <Tooltip content='Sign out'>
                <button
                    type='button'
                    aria-label='Sign out'
                    onClick={model.signOut}
                    className='grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground'
                >
                    <LogOut className='size-4' aria-hidden />
                </button>
            </Tooltip>
        </div>
    );
}

/** The current page's name from the document title, e.g. "Survival | Console" gives "Console". */
function Crumb({ area }: { area: AppArea }) {
    const title = usePageTitle() ?? '';
    const parts = title.split('|').map((part) => part.trim()).filter(Boolean);
    const page = parts.length > 1 ? parts[parts.length - 1] : area.kind === 'dashboard' ? null : parts[0];

    if (!page || (area.kind === 'server' && page === area.name)) return null;

    return (
        <span className='hidden min-w-0 items-center gap-3 text-sm font-semibold text-muted-foreground sm:flex'>
            <span aria-hidden className='text-border'>
                /
            </span>
            <span className='truncate text-foreground/80'>{page}</span>
        </span>
    );
}

/** A sidebar beside the page on large screens, a drawer behind the menu button below them. */
export default function Shell({ model, children }: ViewProps<'layout.app'>) {
    const [open, setOpen] = useState(false);
    const { pathname } = usePanelLocation();
    const { touch } = useRecent();
    const { area } = model;

    useEffect(() => setOpen(false), [pathname]);
    useEffect(() => {
        if (area.kind === 'server') touch(area.identifier);
        // Only when the server changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [area.kind === 'server' ? area.identifier : null]);

    return (
        <div className='obs-shell min-h-dvh lg:flex' data-obsidian-layout>
            <Decor />
            <SpinnerOverlay visible={model.signingOut} fixed />
            {open && (
                <button
                    type='button'
                    aria-label='Close menu'
                    onClick={() => setOpen(false)}
                    className='fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden'
                />
            )}
            <aside
                id='obsidian-sidebar'
                className={cn(
                    'z-50 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-3 pt-3 pb-3',
                    'fixed inset-y-0 left-0 w-[min(18rem,85vw)] overflow-y-auto lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-sidebar lg:shrink-0',
                    'scrollbar-thin scrollbar-thumb-(--scrollbar-thumb)',
                    open ? 'flex' : 'hidden'
                )}
            >
                <button
                    type='button'
                    aria-label='Close menu'
                    onClick={() => setOpen(false)}
                    className='absolute top-4 right-3 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden'
                >
                    <X className='size-4' aria-hidden />
                </button>
                <Sidebar model={model} />
                <div className='mt-auto pt-4'>
                    <UserCard model={model} />
                </div>
            </aside>
            <div className='flex min-w-0 flex-1 flex-col'>
                <header className='obs-topbar sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-transparent bg-background/92 px-4 sm:px-6 lg:px-8'>
                    <button
                        type='button'
                        aria-expanded={open}
                        aria-controls='obsidian-sidebar'
                        aria-label='Open menu'
                        onClick={() => setOpen(true)}
                        className='grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground lg:hidden'
                    >
                        <Menu className='size-4' aria-hidden />
                    </button>
                    <Switcher area={area} />
                    <Crumb area={area} />
                    <div className='ml-auto'>
                        <View name='app.search' />
                    </div>
                </header>
                <Main className='min-w-0 flex-1'>{children}</Main>
            </div>
        </div>
    );
}
