import { useEffect, useState } from 'preact/hooks';

const query = value => globalThis.matchMedia?.(value);

export function useResponsiveMode() {
	const read = () => {
		const width = globalThis.innerWidth || 1920;
		return {
			phone: query('(max-width: 720px)')?.matches ?? width <= 720,
			tablet: query('(min-width: 721px) and (max-width: 1180px)')?.matches ?? (width > 720 && width <= 1180),
		};
	};
	const [mode, setMode] = useState(read);
	useEffect(() => {
		const update = () => setMode(read());
		globalThis.addEventListener('resize', update);
		return () => globalThis.removeEventListener('resize', update);
	}, []);
	return { ...mode, desktop: !mode.phone && !mode.tablet };
}
