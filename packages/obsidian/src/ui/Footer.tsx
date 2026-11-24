import type { PrimitiveProps } from '@pterodactyl/sdk/theme';
import { cn } from '@pterodactyl/sdk/theme';
import { useObsidian } from '../lib/settings';
import Credit from './Credit';

export default function Footer({ className }: PrimitiveProps<'PageFooter'>) {
    const { footer } = useObsidian();

    return (
        <div data-ui='page-footer' data-part='root' className={cn('mt-10 mb-6 flex justify-center px-4', className)}>
            <p
                data-part='text'
                className='flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted-foreground/60'
            >
                {footer.trim() ? (
                    <span>{footer}</span>
                ) : (
                    <span>
                        <a
                            rel='noopener nofollow noreferrer'
                            href='https://pterodactyl.io'
                            target='_blank'
                            className='text-muted-foreground/70 no-underline hover:text-foreground'
                        >
                            Pterodactyl&reg;
                        </a>{' '}
                        &copy; 2015 - {new Date().getFullYear()}
                    </span>
                )}
                <span aria-hidden className='text-border'>
                    ·
                </span>
                <Credit />
            </p>
        </div>
    );
}
