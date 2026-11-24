import { useId, type FormEvent } from 'react';
import { Button, Input, Label, PanelLink, type FieldModel } from '@pterodactyl/sdk';
import { Slot, type ViewProps } from '@pterodactyl/sdk/theme';

function Field({ field, label, action }: { field: FieldModel; label: string; action?: React.ReactNode }) {
    const id = useId();

    return (
        <div className='space-y-1.5'>
            <div className='flex items-baseline justify-between'>
                <Label htmlFor={id}>{label}</Label>
                {action}
            </div>
            <Input
                {...field.fieldProps}
                id={id}
                $hasError={field.error !== null}
                aria-invalid={field.error !== null || undefined}
                aria-describedby={field.error ? `${id}-error` : undefined}
                className='h-11'
            />
            {field.error && (
                <p id={`${id}-error`} className='text-xs text-destructive'>
                    {field.error}
                </p>
            )}
        </div>
    );
}

export default function LoginPage({ model }: ViewProps<'page.auth.login'>) {
    const { fields, Captcha } = model;
    const submit = (event: FormEvent) => {
        event.preventDefault();
        model.submit();
    };

    return (
        <form onSubmit={submit} className='mx-auto w-full max-w-sm space-y-5'>
            <div>
                <h1 className='font-header text-3xl font-bold tracking-tight'>Welcome back</h1>
                <p className='mt-1 text-sm text-muted-foreground'>Sign in to manage your servers.</p>
            </div>
            <Field field={fields.username} label='Username or email' />
            <Field
                field={fields.password}
                label='Password'
                action={
                    <PanelLink
                        destination={model.forgotPassword}
                        className='text-xs text-muted-foreground no-underline hover:text-foreground'
                    >
                        Forgot it?
                    </PanelLink>
                }
            />
            {Captcha && <Captcha />}
            <Button type='submit' size='xlarge' disabled={!model.canSubmit} isLoading={model.submitting}>
                Sign in
            </Button>
            <Slot name='auth.login.form.after' data={model.route} />
        </form>
    );
}
