import type { ReactNode } from 'react';
import { Image, KeyRound, Lock, Mail } from 'lucide-react';
import { Alert, Avatar, Badge, PageContentBlock, useCurrentUser } from '@pterodactyl/sdk';
import { Slot, View, type ViewProps } from '@pterodactyl/sdk/theme';

/** A settings section: what it is on the left, the panel's own form card on the right. */
function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
    return (
        <section className='grid gap-5 border-t border-border py-8 first-of-type:border-t-0 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:gap-10'>
            <div>
                <span className='grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground'>
                    {icon}
                </span>
                <h2 className='mt-3 text-base font-bold tracking-tight'>{title}</h2>
                <p className='mt-1 text-sm text-muted-foreground'>{description}</p>
            </div>
            <div className='min-w-0 max-w-xl'>{children}</div>
        </section>
    );
}

/** The account page: a profile header, then each setting as a described section. */
export default function AccountOverview({ model, className }: ViewProps<'page.account.overview'>) {
    const user = useCurrentUser();

    return (
        <PageContentBlock title='Account' className={className}>
            <h1 className='font-header text-3xl font-bold tracking-tight'>Account</h1>
            <p className='mt-1 text-sm text-muted-foreground'>Your login details and two-step verification.</p>
            {model.twoFactorRequired && (
                <Alert title='Two-step verification required' type='danger' className='mt-5'>
                    Your account must have two-step verification turned on before you can continue.
                </Alert>
            )}
            <div className='obs-surface mt-6 flex flex-wrap items-center gap-4 p-5'>
                <Avatar name={user.uuid} image={user.avatar} size={60} />
                <div className='min-w-0 flex-1'>
                    <p className='truncate text-xl font-bold tracking-tight'>{user.username}</p>
                    <p className='truncate font-mono text-sm text-muted-foreground'>{user.email}</p>
                </div>
                <Badge tone={user.useTotp ? 'success' : 'warning'} variant='soft'>
                    {user.useTotp ? 'Two-step on' : 'Two-step off'}
                </Badge>
            </div>
            <Slot name='account.overview.before' />
            <div className='mt-4'>
                <Section icon={<Lock className='size-4' />} title='Password' description="Pick a long passphrase you don't use anywhere else.">
                    <View name='account.password' />
                </Section>
                <Section icon={<Mail className='size-4' />} title='Email address' description='Where we send sign-in alerts and password resets.'>
                    <View name='account.email' />
                </Section>
                <Section
                    icon={<KeyRound className='size-4' />}
                    title='Two-step verification'
                    description='A code from your authenticator app on every sign-in.'
                >
                    <View name='account.twoFactor' />
                </Section>
                {model.userAvatarsEnabled && (
                    <Section icon={<Image className='size-4' />} title='Avatar' description='Shown beside your name across the panel.'>
                        <View name='account.avatar' />
                    </Section>
                )}
            </div>
            <Slot name='account.overview.after' />
        </PageContentBlock>
    );
}
