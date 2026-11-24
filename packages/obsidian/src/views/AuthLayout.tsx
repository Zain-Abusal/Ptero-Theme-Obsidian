import { type ViewProps } from '@pterodactyl/sdk/theme';
import { brandName, useObsidian } from '../lib/settings';
import BrandMark from '../ui/BrandMark';
import Decor from '../ui/Decor';

/**
 * A split screen: the brand and tagline beside the sign-in pages. Classic's layer still renders the
 * pages (through `Default`), which keeps the brand context its two-factor and reset cards read.
 * Imports nothing from `@pterodactyl/sdk`, so sign-in paints before the SDK chunk loads.
 */
export default function AuthLayout({ model, Default }: ViewProps<'layout.auth'>) {
    const settings = useObsidian();
    const name = brandName(model.brand.name, settings);

    return (
        <div className='obs-shell grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]'>
            <Decor />
            <section className='relative hidden flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-12 lg:flex'>
                <div className='flex items-center gap-3 text-lg font-bold tracking-tight'>
                    {model.brand.logoUrl ? (
                        <img src={model.brand.logoUrl} alt='' className='h-9 w-auto max-w-40 object-contain' />
                    ) : (
                        <BrandMark className='size-9' />
                    )}
                    {name}
                </div>
                <p className='max-w-md font-header text-[2.6rem] leading-[1.1] font-bold tracking-tight text-balance'>
                    {settings.tagline.split(' ').slice(0, -1).join(' ')}{' '}
                    <span className='font-serif font-normal italic'>{settings.tagline.split(' ').slice(-1)}</span>
                </p>
                <p className='text-xs text-muted-foreground'>
                    &copy; {new Date().getFullYear()} {name}
                </p>
            </section>
            <div className='flex flex-col justify-center px-5 py-10 sm:px-10'>
                <div className='mb-8 flex items-center justify-center gap-2.5 text-lg font-bold tracking-tight lg:hidden'>
                    {model.brand.logoUrl ? (
                        <img src={model.brand.logoUrl} alt='' className='h-8 w-auto object-contain' />
                    ) : (
                        <BrandMark />
                    )}
                    {name}
                </div>
                <Default className='pt-0 xl:pt-0' />
            </div>
        </div>
    );
}
