import { type ViewProps } from '@pterodactyl/sdk/theme';
import { brandName, useObsidian } from '../lib/settings';
import BrandMark from '../ui/BrandMark';
import Decor from '../ui/Decor';
import Credit from '../ui/Credit';

export default function AuthLayout({ model, Default }: ViewProps<'layout.auth'>) {
    const settings = useObsidian();
    const name = brandName(model.brand.name, settings);

    return (
        <div className='obs-shell grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]'>
            <Decor />
            <section className='relative z-1 hidden flex-col justify-between overflow-hidden border-r border-border bg-sidebar p-12 lg:flex'>
                <div className='flex items-center gap-3 text-lg font-bold tracking-tight'>
                    {model.brand.logoUrl ? (
                        <img src={model.brand.logoUrl} alt='' className='h-9 w-auto max-w-40 object-contain' />
                    ) : (
                        <BrandMark className='size-9' />
                    )}
                    {name}
                </div>
                <p className='max-w-md font-header text-[2.6rem] leading-[1.1] font-bold tracking-tight text-balance'>
                    {settings.tagline}
                </p>
                <p className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
                    <span>
                        &copy; {new Date().getFullYear()} {name}
                    </span>
                    <Credit />
                </p>
            </section>
            <div className='relative z-1 flex flex-col justify-center px-5 py-10 sm:px-10'>
                <div className='mb-8 flex items-center justify-center gap-2.5 text-lg font-bold tracking-tight lg:hidden'>
                    {model.brand.logoUrl ? (
                        <img src={model.brand.logoUrl} alt='' className='h-8 w-auto object-contain' />
                    ) : (
                        <BrandMark />
                    )}
                    {name}
                </div>
                <Default className='pt-0 xl:pt-0' />
                <p className='mt-10 text-center text-xs text-muted-foreground lg:hidden'>
                    <Credit />
                </p>
            </div>
        </div>
    );
}
