import { CloseButton, Group } from '@mantine/core';
import { useApp } from '../store/app';

// Notice bars on top of the window (updates, permissions, errors)
export function Banners() {
	const banners = useApp((s) => s.banners);
	const close = useApp((s) => s.closeBanner);

	return (
		<>
			{banners.map((banner) => (
				<Group key={banner.id} className="banner" justify="center" gap="sm" wrap="nowrap" style={{ background: banner.color }}>
					{banner.content}
					<CloseButton className="banner-close" size="sm" onClick={() => close(banner.id)} />
				</Group>
			))}
		</>
	);
}
