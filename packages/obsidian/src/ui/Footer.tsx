import type { PrimitiveProps } from '@pterodactyl/sdk/theme';
import { cn } from '@pterodactyl/sdk/theme';
import { useObsidian } from '../lib/settings';

/**
 * The line under every page: the administrator's footer text when set, the panel's attribution
 * otherwise. It replaces the PageFooter primitive, so it renders its own markup.
 */
export default function Footer({ className }: PrimitiveProps<'PageFooter'>) {
    const { footer } = useObsidian();

    return (
        <div data-ui='page-footer' data-part='root' className={cn('mt-10 mb-6 flex justify-center', className)}>
            <p data-part='text' className='text-center text-xs text-muted-foreground/50'>
                {footer.trim() ? (
                    footer
                ) : (
                    <>
                        <a
                            rel='noopener nofollow noreferrer'
                            href='https://pterodactyl.io'
                            target='_blank'
                            className='text-muted-foreground/60 no-underline hover:text-foreground'
                        >
                            Pterodactyl&reg;
                        </a>{' '}
                        &copy; 2015 – {new Date().getFullYear()}
                    </>
                )}
            </p>
        </div>
    );
}
