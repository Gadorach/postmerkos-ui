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
					const remote = createConnection({ host, port: 4001 }, () => {
						const headers = ['GET / HTTP/1.1'];
						for (const [key, value] of Object.entries(req.headers))
							headers.push(key.toLowerCase() === 'host' ? `Host: ${host}:4001` : `${key}: ${value}`);
						remote.write(headers.join('\r\n') + '\r\n\r\n');
						if (head.length) remote.write(head);
						remote.pipe(socket); socket.pipe(remote);
					});
					remote.on('error', () => socket.destroy());
					socket.on('error', () => remote.destroy());
					return;
				}
				const wss = new WebSocketServer({ noServer: true });
				wss.handleUpgrade(req, socket, head, ws => {
					const configData = JSON.parse(readFileSync(resolve('src/test/24/config'), 'utf-8'));
					const statusData = JSON.parse(readFileSync(resolve('src/test/24/status'), 'utf-8'));
					let authenticated = false;
					let upload = null;
					let servicePolicy = { ssh: { enabled: true, autostart: true, password_auth: true, port: 22 }, web: { enabled: true, autostart: true }, chrony: { enabled: true, autostart: true } };
					let timePolicy = { timezone: 'America/Moncton', standard_offset_minutes: -240, dst: { enabled: true, offset_minutes: -180, start: { month: 3, week: 2, weekday: 0, hour: 2, minute: 0 }, end: { month: 11, week: 1, weekday: 0, hour: 2, minute: 0 } }, ntp_enabled: true, servers: ['pool.ntp.org'] };
					const timeData = () => ({ utc: new Date().toISOString(), local: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().replace(/Z$/, ''), offset_minutes: -180, dst_active: true, policy: timePolicy });
					const send = (type, data, id) => ws.send(JSON.stringify({ ...(id != null ? { id } : {}), type, data }));
					const merge = (target, delta) => {
						for (const [key, value] of Object.entries(delta)) {
							if (value === null) delete target[key];
							else if (value && typeof value === 'object' && !Array.isArray(value)) target[key] = merge({ ...(target[key] ?? {}) }, value);
							else target[key] = value;
						}
						return target;
					};
					send('auth_required', { message: 'Development mock login: any non-empty username/password.' });
					const interval = setInterval(() => { if (authenticated && ws.readyState === ws.OPEN) send('status', statusData); }, 3000);
					ws.on('message', (raw, isBinary) => {
						if (isBinary) { if (authenticated && upload) upload.received += raw.length; return; }
						let msg;
						try { msg = JSON.parse(raw.toString()); } catch { send('error', { status: 400, message: 'Bad Request' }); return; }
						if (msg.type === 'hello') { send('hello', { service: 'configd', protocol: 2 }, msg.id); return; }
						if (msg.type === 'auth') {
							if (!msg.data?.username || !msg.data?.password) send('error', { status: 401, message: 'Unauthorized' }, msg.id);
							else { authenticated = true; send('auth', { username: msg.data.username, role: 'administrator', capabilities: ['status.read','config.read','ports.write','switching.write','backup.create','system.reboot','firmware.update','config.restore','network.write','users.manage','services.manage','terminal.exec'], users: [{ username: msg.data.username, role: 'administrator' }] }, msg.id); send('config', configData); send('status', statusData); }
							return;
						}
						if (msg.type === 'logout') { authenticated = false; send('auth_required', { message: 'Logged out' }, msg.id); return; }
						if (!authenticated) { send('error', { status: 401, message: 'Unauthorized' }, msg.id); return; }
						if (msg.type === 'get_config') send('config', configData, msg.id);
						else if (msg.type === 'get_status') send('status', statusData, msg.id);
						else if (msg.type === 'config' && msg.data && typeof msg.data === 'object') { merge(configData, msg.data); send('ack', { message: 'Configuration accepted', applied: 1, warnings: [] }, msg.id); send('config', configData); }
						else if (msg.type === 'replace_config' && msg.data && typeof msg.data === 'object') { for (const key of Object.keys(configData)) delete configData[key]; Object.assign(configData, msg.data); send('ack', { message: 'Configuration replaced', applied: 1, warnings: [] }, msg.id); send('config', configData); }
						else if (msg.type === 'terminal_start') { const token = `mock-${Date.now()}`; send('terminal_started', { token, message: 'Terminal command started' }, msg.id); setTimeout(() => send('terminal_output', { token, output: `mock: ${msg.data?.command ?? ''}\n` }), 25); setTimeout(() => send('terminal_exit', { token, exit_code: 0, timed_out: false, truncated: false }), 50); }
						else if (msg.type === 'terminal_exec') send('terminal', { output: `mock: ${msg.data?.command ?? ''}\n`, exit_code: 0, timed_out: false, truncated: false }, msg.id);
						else if (msg.type === 'password_change') send('ack', { message: 'Development mock password updated' }, msg.id);
						else if (msg.type === 'user_list') send('users', { users: [{ username: 'root', role: 'admin' }, { username: 'operator', role: 'operator' }] }, msg.id);
						else if (msg.type === 'ssh_key_list') send('ssh_keys', { keys: [] }, msg.id);
						else if (msg.type === 'services_get') send('services', servicePolicy, msg.id);
						else if (msg.type === 'services_set') { servicePolicy = msg.data; send('ack', { message: 'Service policy saved and applied' }, msg.id); }
						else if (msg.type === 'time_get') send('time', timeData(), msg.id);
						else if (msg.type === 'time_set') { timePolicy = msg.data; send('ack', { message: 'Time policy saved' }, msg.id); }
						else if (msg.type === 'time_set_clock') send('ack', { message: 'System clock updated' }, msg.id);
						else if (msg.type === 'time_sync') send('ack', { message: 'Synchronization requested' }, msg.id);
						else if (msg.type === 'compatibility_report') send('compatibility_report', { model: statusData.device, firmware: statusData.release?.version ?? 'development', compatibility: 'confirmed', family: 'jaguar1', port_count: Object.keys(configData.ports ?? {}).length, copper_ports: Math.max(0, Object.keys(configData.ports ?? {}).length - 4), uplink_ports: 4, poe_supported: true, poe_available: true, poe_controllers: 2, switch_instances: 1, mac_oui: statusData.system?.identity?.base_mac?.slice(0, 8) ?? '00:18:0a', project_repo: 'https://github.com/Gadorach/meraki-builder' }, msg.id);
						else if (msg.type === 'compatibility_ack') send('ack', { message: 'Compatibility acknowledged' }, msg.id);
						else if (msg.type === 'firmware_status') send('firmware_status', { state: 'idle', stage: 'idle', progress: 0, message: 'No update running' }, msg.id);
						else if (msg.type === 'firmware_upload_start') { upload = { expected: msg.data?.size ?? 0, received: 0 }; send('firmware_upload_ready', { active: true, expected: upload.expected, received: 0, progress: 0 }, msg.id); }
						else if (msg.type === 'firmware_upload_cancel') { upload = null; send('ack', { message: 'Upload cancelled' }, msg.id); }
						else if (msg.type === 'firmware_upload_finish') { if (!upload || upload.received !== upload.expected) send('error', { status: 400, message: 'Upload size mismatch' }, msg.id); else { upload = null; send('firmware_started', { message: 'Mock firmware handoff complete' }, msg.id); } }
						else send('error', { status: 400, message: 'Bad Request' }, msg.id);
					});
					ws.on('close', () => clearInterval(interval));
				});
			});
		},
	};
}

export default defineConfig({
	plugins: [preact(), wsPlugin()],
	build: { sourcemap: false, outDir: 'build' },
	publicDir: 'assets',
	server: { port: 8080 },
});
