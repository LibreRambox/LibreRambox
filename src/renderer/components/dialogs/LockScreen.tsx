import { useEffect, useRef, useState } from 'react';
import { Button, PasswordInput, Stack, Title } from '@mantine/core';
import { IconLockOpen } from '@tabler/icons-react';
import { resourceUrl } from '../../electron';
import { t } from '../../i18n';
import { useApp } from '../../store/app';
import { unlockLibreRambox } from '../../actions';

export function LockScreen() {
	const locked = useApp((s) => s.locked);
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if ( !locked ) return;
		setPassword('');
		setError('');
		const timer = setTimeout(() => inputRef.current?.focus(), 1000);
		return () => clearTimeout(timer);
	}, [locked]);

	if ( !locked ) return null;

	const validate = () => {
		if ( unlockLibreRambox(password) ) return;
		setPassword('');
		setError('Unlock password is invalid');
	};

	return (
		<div className="lock-screen" onClick={() => inputRef.current?.focus()}>
			<Stack w={256} align="stretch">
				<img src={resourceUrl('Icon.png')} width={256} height={256} alt="" />
				<Title order={1} ta="center" c="white">{t('app.window[26]')}</Title>
				<PasswordInput
					ref={inputRef}
					value={password}
					error={error}
					onChange={(e) => { setPassword(e.currentTarget.value); setError(''); }}
					onKeyDown={(e) => e.key === 'Enter' && validate()}
				/>
				<Button size="lg" leftSection={<IconLockOpen size={18} />} onClick={validate}>{t('app.window[27]')}</Button>
			</Stack>
		</div>
	);
}
