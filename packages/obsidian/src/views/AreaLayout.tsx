import type { ReactNode } from 'react';
import { Main } from '@pterodactyl/sdk/theme';

export default function AreaLayout({ children }: { children?: ReactNode }) {
    return <Main>{children}</Main>;
}
