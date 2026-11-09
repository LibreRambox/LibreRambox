import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles/global.css';
import { theme } from './styles/theme';
import { loadLocale } from './i18n';

// The locale must be loaded before any component reads a translation
loadLocale().then(async () => {
	const { App } = await import('./App');
	// No StrictMode: its double mounting would create every <webview> twice
	createRoot(document.getElementById('root')!).render(
		<MantineProvider theme={theme}>
			<ModalsProvider>
				<Notifications />
				<App />
			</ModalsProvider>
		</MantineProvider>,
	);
});
