export default function Credit() {
    return (
        <span className='inline-flex items-center gap-1'>
            Made with
            <span aria-label='love' className='text-destructive'>
                ♥
            </span>
            by
            <a
                href='https://zcraftstudios.com'
                target='_blank'
                rel='noopener'
                className='font-semibold text-muted-foreground no-underline transition-colors hover:text-foreground'
            >
                ZCS
            </a>
        </span>
    );
}
