import { useState } from 'preact/hooks';

export default function Login({ connected, connectionState, onLogin, error }) {
	const [username, setUsername] = useState('root');
	const [password, setPassword] = useState('');
	const [working, setWorking] = useState(false);
	const submit = async event => {
		event.preventDefault(); setWorking(true);
		try { await onLogin(username, password); setPassword(''); }
		finally { setWorking(false); }
	};
	return <div className="login-page"><form className="login-card" onSubmit={submit}>
		<h1>postmerkOS</h1>
		<p>Sign in with an authorized local Linux account.</p>
		<label>Username<input autoFocus autoComplete="username" value={username} onInput={event => setUsername(event.currentTarget.value)} /></label>
		<label>Password<input type="password" autoComplete="current-password" value={password} onInput={event => setPassword(event.currentTarget.value)} /></label>
		<button disabled={!connected || working || !username || !password}>{working ? 'signing in…' : connected ? 'sign in' : 'connecting…'}</button>
		<div className="connection-detail">{connectionState}</div>
		{error && <div className="error">{error}</div>}
	</form></div>;
}
