import type { ReactNode } from 'react';
import { Main } from '@pterodactyl/sdk/theme';

/** The shell draws every area's navigation, so an area's layout only places its pages. */
export default function AreaLayout({ children }: { children?: ReactNode }) {
    return <Main>{children}</Main>;
}
