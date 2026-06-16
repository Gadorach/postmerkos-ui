import { useState } from 'preact/hooks';

export default function Login({ connected, onLogin, error }) {
	const [username, setUsername] = useState('root');
	const [password, setPassword] = useState('');
	const [working, setWorking] = useState(false);

	const submit = async event => {
		event.preventDefault();
		setWorking(true);
		try {
			await onLogin(username, password);
			setPassword('');
		} finally {
			setWorking(false);
		}
	};

	return <main className="login-page">
		<form className="login-card" onSubmit={submit}>
			<h1>postmerkOS</h1>
			<p>Authenticate with a local Linux account to manage this switch.</p>
			<label>Username<input autocomplete="username" value={username} onInput={event => setUsername(event.currentTarget.value)} /></label>
			<label>Password<input type="password" autocomplete="current-password" value={password} onInput={event => setPassword(event.currentTarget.value)} /></label>
			<button type="submit" disabled={!connected || working || !username || !password}>{working ? 'Authenticating…' : 'Sign in'}</button>
			<div className={`connection-state ${connected ? 'connected' : 'disconnected'}`}>{connected ? 'management service connected' : 'connecting to management service'}</div>
			{error && <div className="error">{error}</div>}
		</form>
	</main>;
}
