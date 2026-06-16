import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { WebSocketServer } from 'ws';
import { createConnection } from 'net';

function wsPlugin() {
	const host = process.env.SWITCH_HOST;

	return {
		name: 'ws-dev',
		configureServer(server) {
			server.httpServer.on('upgrade', (req, socket, head) => {
				if (req.url !== '/ws') return;

				if (host) {
					// Proxy mode: forward to real device
					const remote = createConnection({ host, port: 4001 }, () => {
						// Forward the original HTTP upgrade request to the remote server
						const headers = [`GET / HTTP/1.1`];
						for (const [key, value] of Object.entries(req.headers)) {
							// Replace host header with actual target
							if (key.toLowerCase() === 'host') {
								headers.push(`Host: ${host}:4001`);
							} else {
								headers.push(`${key}: ${value}`);
							}
						}
						remote.write(headers.join('\r\n') + '\r\n\r\n');
						if (head.length) remote.write(head);

						// Pipe responses back to client and subsequent data both ways
						remote.pipe(socket);
						socket.pipe(remote);
					});
					remote.on('error', () => socket.destroy());
					socket.on('error', () => remote.destroy());
					return;
				}

				// Mock mode: serve test data behind a development-only PAM-like login.
				const wss = new WebSocketServer({ noServer: true });
				wss.handleUpgrade(req, socket, head, (ws) => {
					const configData = JSON.parse(readFileSync(resolve('src/test/24/config'), 'utf-8'));
					const statusData = JSON.parse(readFileSync(resolve('src/test/24/status'), 'utf-8'));
					let authenticated = false;
					let upload = null;
					const send = (type, data, id) => ws.send(JSON.stringify({ ...(id != null ? { id } : {}), type, data }));
					send('auth_required', { message: 'Development mock login: use any non-empty username and password.' });

					const interval = setInterval(() => {
						if (authenticated && ws.readyState === ws.OPEN) send('status', statusData);
					}, 3000);

					const merge = (target, delta) => {
						for (const [key, value] of Object.entries(delta)) {
							if (value === null) delete target[key];
							else if (value && typeof value === 'object' && !Array.isArray(value)) target[key] = merge({ ...(target[key] ?? {}) }, value);
							else target[key] = value;
						}
						return target;
					};

					ws.on('message', (raw, isBinary) => {
						if (isBinary) {
							if (authenticated && upload) upload.received += raw.length;
							return;
						}
						let msg;
						try { msg = JSON.parse(raw.toString()); } catch { send('error', { status: 400, message: 'Bad Request' }); return; }
						if (msg.type === 'auth') {
							if (!msg.data?.username || !msg.data?.password) send('error', { status: 401, message: 'Unauthorized' }, msg.id);
							else {
								authenticated = true;
								send('auth', { username: msg.data.username, users: [{ username: msg.data.username }] }, msg.id);
								send('config', configData); send('status', statusData);
							}
							return;
						}
						if (msg.type === 'logout') { authenticated = false; send('auth_required', { message: 'Logged out' }, msg.id); return; }
						if (!authenticated) { send('error', { status: 401, message: 'Unauthorized' }, msg.id); return; }
						if (msg.type === 'get_config') send('config', configData, msg.id);
						else if (msg.type === 'get_status') send('status', statusData, msg.id);
						else if (msg.type === 'config' && msg.data && typeof msg.data === 'object') {
							merge(configData, msg.data); send('ack', { message: 'Configuration accepted', applied: 1, warnings: [] }, msg.id); send('config', configData);
						} else if (msg.type === 'replace_config' && msg.data && typeof msg.data === 'object') {
							for (const key of Object.keys(configData)) delete configData[key]; Object.assign(configData, msg.data);
							send('ack', { message: 'Configuration replaced', applied: 1, warnings: [] }, msg.id); send('config', configData);
						} else if (msg.type === 'terminal_exec') send('terminal', { output: `mock: ${msg.data?.command ?? ''}\n`, exit_code: 0, timed_out: false, truncated: false }, msg.id);
						else if (msg.type === 'password_change') send('ack', { message: 'Development mock password updated' }, msg.id);
						else if (msg.type === 'firmware_status') send('firmware_status', { state: 'idle', stage: 'idle', progress: 0, message: 'No update running' }, msg.id);
						else if (msg.type === 'firmware_upload_start') { upload = { expected: msg.data?.size ?? 0, received: 0 }; send('ack', { message: 'Upload ready' }, msg.id); }
						else if (msg.type === 'firmware_upload_cancel') { upload = null; send('ack', { message: 'Upload cancelled' }, msg.id); }
						else if (msg.type === 'firmware_upload_finish') {
							if (!upload || upload.received !== upload.expected) send('error', { status: 400, message: 'Upload size mismatch' }, msg.id);
							else { upload = null; send('ack', { message: 'Mock firmware handoff complete' }, msg.id); }
						} else send('error', { status: 400, message: 'Bad Request' }, msg.id);
					});
					ws.on('close', () => clearInterval(interval));
				});
			});
		},
	};
}

export default defineConfig({
	plugins: [
		preact(),
		wsPlugin(),
	],
	build: {
		sourcemap: false,
		outDir: 'build',
	},
	publicDir: 'assets',
	server: {
		port: 8080,
	},
});
