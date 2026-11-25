import { View, type ViewProps } from '@pterodactyl/sdk/theme';
import FlagsScreen from '../tools/screens/FlagsScreen';

export default function StartupVariables({ model, Default, className }: ViewProps<'server.startup.variables'>) {
    return (
        <div className={className}>
            <Default model={model} />
            <FlagsScreen embedded />
        </div>
    );
}
