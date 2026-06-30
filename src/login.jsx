import { useEffect, useMemo, useState } from 'preact/hooks';

const stateModel = (connected, connectionState, error) => {
	if (error) return { level: 'error', title: 'Sign-in unavailable', message: error, details: connectionState };
	if (!connected) return { level: 'progress', title: 'Connecting', message: connectionState || 'Connecting to configd…', details: 'The page will enable Sign In when the management protocol is ready.' };
	return { level: 'ready', title: 'Ready for authentication', message: connectionState || 'Connected to configd.', details: 'Use an authorized local Linux account.' };
};

export default function Login({ connected, connectionState, onLogin, error }) {
	const [username, setUsername] = useState('root');
	const [password, setPassword] = useState('');
	const [remember, setRemember] = useState(() => { try { return localStorage.getItem('pmos.rememberLogin') === '1'; } catch (error) { return false; } });
	const [working, setWorking] = useState(false);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const status = useMemo(() => stateModel(connected, connectionState, error), [connected, connectionState, error]);
	useEffect(() => { try { localStorage.setItem('pmos.rememberLogin', remember ? '1' : '0'); } catch (error) { /* storage unavailable */ } }, [remember]);
	const submit = async event => {
		event.preventDefault(); setWorking(true);
		try { await onLogin(username, password, remember); setPassword(''); }
		finally { setWorking(false); }
	};
	return <main className="login-page"><section className="login-card" aria-labelledby="login-title">
		<header className="login-brand"><h1 id="login-title">postmerkOS</h1><p>Local switch management</p></header>
		<form className="login-form" onSubmit={submit}>
			<label>Username<input name="username" autoFocus autoComplete="username" value={username} onInput={event => setUsername(event.currentTarget.value)} /></label>
			<label>Password<input name="password" type="password" autoComplete="current-password" value={password} onInput={event => setPassword(event.currentTarget.value)} /></label>
			<label className="login-preference"><input type="checkbox" checked={remember} onChange={event => setRemember(event.currentTarget.checked)} /><span><strong>Remember me on this device</strong><small>Stores the session token, never the password.</small></span></label>
			<button className="login-submit" disabled={!connected || working || !username || !password}>{working ? 'Signing in…' : connected ? 'Sign in' : 'Connecting…'}</button>
		</form>
		<section className={`login-status login-status-${status.level}`} aria-live={status.level === 'error' ? undefined : 'polite'} role={status.level === 'error' ? 'alert' : 'status'}>
			<div className="login-status-head"><span className="login-status-dot" aria-hidden="true" /><strong>{status.title}</strong></div>
			<p>{status.message}</p>
			<details open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}><summary>Details</summary><p>{status.details}</p></details>
		</section>
	</section></main>;
}
