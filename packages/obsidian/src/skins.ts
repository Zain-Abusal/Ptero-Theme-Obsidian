import { skin, type PrimitiveState, type ThemeSkins } from '@pterodactyl/sdk/theme';

type ButtonState = PrimitiveState<'Button'>;

const fills: Record<ButtonState['color'], string> = {
    primary: 'bg-primary text-primary-foreground hover:not-disabled:bg-primary/88',
    grey: 'bg-secondary text-foreground ring-1 ring-inset ring-border hover:not-disabled:bg-muted',
    green: 'bg-success text-success-foreground hover:not-disabled:bg-success/88',
    red: 'bg-destructive/12 text-destructive ring-1 ring-inset ring-destructive/35 hover:not-disabled:bg-destructive/20',
    orange: 'bg-caution/12 text-caution ring-1 ring-inset ring-caution/35 hover:not-disabled:bg-caution/20',
};

const sizes: Record<ButtonState['size'], string> = {
    xsmall: 'h-7 px-3 text-xs',
    small: 'h-9 px-4 text-sm',
    large: 'h-10 px-5 text-sm',
    xlarge: 'h-11 w-full px-6 text-sm',
};

/** Pill buttons: a solid primary, quiet tinted danger and caution, and a hairline secondary. */
const button = skin('Button', {
    root: ({ color, size, secondary }) =>
        [
            'relative inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap',
            'transition-[background-color,box-shadow,opacity,transform] duration-150 active:not-disabled:scale-[0.98]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
            sizes[size],
            secondary
                ? 'bg-transparent text-foreground ring-1 ring-inset ring-border hover:not-disabled:bg-muted'
                : fills[color],
        ].join(' '),
});

/** Cards on a hairline, a larger radius and a quiet header. */
const card = skin('Card', {
    root: (state, below) => below('rounded-xl border border-border bg-card shadow-none'),
    header: (state, below) => below('border-b border-border px-5 py-3.5'),
    title: 'font-header text-sm font-semibold tracking-tight text-foreground',
    body: (state, below) => below('p-5'),
});

const stat = skin('Stat', {
    root: (state, below) => below('rounded-xl bg-card shadow-sm'),
    label: (state, below) => below('font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground'),
    value: (state, below) => below('font-header font-bold tracking-tight tabular-nums'),
});

const badge = skin('Badge', {
    root: (state, below) => below('rounded-full font-semibold'),
});

const listRow = skin('ListRow', {
    root: (state, below) => below('rounded-xl border border-border bg-card shadow-none'),
});

const input = skin('Input', {
    root: (state, below) => below('rounded-lg border-input-border bg-input focus:ring-ring'),
});

const textArea = skin('TextArea', {
    root: (state, below) => below('rounded-lg border-input-border bg-input'),
});

const switchSkin = skin('Switch', {
    control: (state, below) => below('data-checked:bg-success'),
});

const progress = skin('ProgressBar', {
    root: (state, below) => below('rounded-full'),
    indicator: (state, below) => below('rounded-full'),
});

const dialog = skin('Dialog', {
    root: (state, below) => below('rounded-2xl border border-border bg-card'),
    backdrop: (state, below) => below('bg-black/55'),
});

const dropdown = skin('DropdownMenu', {
    root: (state, below) => below('rounded-xl border border-border bg-popover p-1.5 shadow-xl'),
});

const tooltip = skin('Tooltip', {
    root: 'z-9999 rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-foreground shadow-lg',
});

const pageHeading = skin('PageHeading', {
    title: (state, below) => below('font-header text-3xl font-bold tracking-tight'),
    description: (state, below) => below('text-sm text-muted-foreground'),
});

const table = skin('Table', {
    root: (state, below) => below('rounded-xl'),
    head: (state, below) => below('bg-muted/40'),
});

const footer = skin('PageFooter', {
    text: (state, below) => below('text-xs text-muted-foreground/50'),
    link: (state, below) => below('text-muted-foreground/60 no-underline hover:text-foreground'),
});

export const obsidianSkins: ThemeSkins = {
    Button: button,
    Card: card,
    Stat: stat,
    Badge: badge,
    ListRow: listRow,
    Input: input,
    TextArea: textArea,
    Switch: switchSkin,
    ProgressBar: progress,
    Dialog: dialog,
    DropdownMenu: dropdown,
    Tooltip: tooltip,
    PageHeading: pageHeading,
    Table: table,
    PageFooter: footer,
};
