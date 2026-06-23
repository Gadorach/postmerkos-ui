const KEY = 'pmos.session';

export function saveSession(entry, remember) {
	try {
		const store = remember ? localStorage : sessionStorage;
		const other = remember ? sessionStorage : localStorage;
		store.setItem(KEY, JSON.stringify(entry));
		other.removeItem(KEY);
	} catch (error) { /* storage unavailable */ }
}

export function loadSession() {
	for (const store of [localStorage, sessionStorage]) {
		try {
			const raw = store.getItem(KEY);
			if (!raw) continue;
			const entry = JSON.parse(raw);
			if (entry && entry.token && (!entry.expires_at || entry.expires_at * 1000 > Date.now())) return entry;
			store.removeItem(KEY);
		} catch (error) { /* ignore */ }
	}
	return null;
}

export function clearSession() {
	try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (error) { /* ignore */ }
}
