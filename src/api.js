const WS_SCHEME = location.protocol === 'https:' ? 'wss' : 'ws';
const DEFAULT_URL = `${WS_SCHEME}://${location.host}/ws`;

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export class ConfigdClient {
	constructor({ url = DEFAULT_URL, onStatus, onConfig, onConnection, onConnectionState, onError, onAuth, onAuthRequired } = {}) {
		this.url = url;
		this.onStatus = onStatus;
		this.onConfig = onConfig;
		this.onConnection = onConnection;
		this.onConnectionState = onConnectionState;
		this.onError = onError;
		this.onAuth = onAuth;
		this.onAuthRequired = onAuthRequired;
		this.socket = null;
		this.pending = new Map();
		this.listeners = new Map();
		this.nextId = 1;
		this.reconnectDelay = 1000;
		this.reconnectTimer = null;
		this.stopped = false;
	}

	connect() { this.stopped = false; this.#open(); }
	close() {
		this.stopped = true;
		clearTimeout(this.reconnectTimer);
		this.socket?.close();
		this.socket = null;
		this.#rejectPending(new Error('Connection closed'));
	}

	authenticate(username, password, remember) { return this.request('auth', { username, password, remember: !!remember }); }
	resume(token) { return this.request('auth_token', { token }); }
	certGet() { return this.request('cert_get'); }
	certSet(cert, key) { return this.request('cert_set', { cert, key }); }
	certDelete() { return this.request('cert_delete'); }

	subscribe(type, callback) {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type).add(callback);
		return () => {
			const listeners = this.listeners.get(type);
			listeners?.delete(callback);
			if (listeners?.size === 0) this.listeners.delete(type);
		};
	}

	request(type, data, { timeout = 10000 } = {}) {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN)
			return Promise.reject(new Error('WebSocket not connected'));
		const id = String(this.nextId++);
		const message = { id, type };
		if (data !== undefined) message.data = data;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error('Request timed out'));
			}, timeout);
			this.pending.set(id, { resolve, reject, timeout: timer });
			try { this.socket.send(JSON.stringify(message)); }
			catch (error) {
				clearTimeout(timer); this.pending.delete(id); reject(error);
			}
		});
	}

	async uploadFirmware(file, { manifestFile = null, overlay = 'preserve', force = false, acceptUntested = false, onProgress } = {}) {
		if (!file) throw new Error('Select a firmware image first');
		if (file.size <= 0 || file.size > 16 * 1024 * 1024)
			throw new Error('Firmware image must be between 1 byte and 16 MiB');
		let manifest;
		if (manifestFile) {
			if (manifestFile.size <= 0 || manifestFile.size > 1024 * 1024) throw new Error('Release manifest must be between 1 byte and 1 MiB');
			try { manifest = JSON.parse(await manifestFile.text()); }
			catch { throw new Error('Release manifest is not valid JSON'); }
		}
		onProgress?.({ phase: 'starting', progress: 0 });
		await this.request('firmware_upload_cancel').catch(() => {});
		const startResponse = await this.request('firmware_upload_start', {
			name: file.name, size: file.size, overlay, force, accept_untested: acceptUntested, manifest,
		}, { timeout: 30000 });
		const startToken = startResponse?.data?.token;
		// Stream the image. A failure in THIS loop means the socket dropped
		// mid-upload, so cancel the partial staged file. A slow-but-complete upload
		// must be allowed to reach firmware_upload_finish.
		try {
			const chunkSize = 64 * 1024;
			for (let offset = 0; offset < file.size; offset += chunkSize) {
				const chunk = await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer();
				if (!this.socket || this.socket.readyState !== WebSocket.OPEN)
					throw new Error('Connection was lost during firmware upload');
				this.socket.send(chunk);
				const sent = Math.min(offset + chunk.byteLength, file.size);
				onProgress?.({ phase: 'uploading', progress: Math.round(sent * 100 / file.size), sent, total: file.size });
				if (this.socket.bufferedAmount > 1024 * 1024) {
					while (this.socket?.bufferedAmount > 256 * 1024) await sleep(25);
				}
			}
		} catch (error) {
			this.request('firmware_upload_cancel').catch(() => {});
			throw error;
		}
		onProgress?.({ phase: 'verifying', progress: 100 });
		// Validation is an asynchronous configd job. Polling makes the operation
		// recoverable across request timeouts and WebSocket reconnects without
		// forcing the image to be uploaded again.
		let finishResponse;
		try {
			finishResponse = await this.request('firmware_upload_finish', undefined, { timeout: 30000 });
		} catch (error) {
			// A transport timeout can race with a successful server-side handoff.
			// Query the durable validation job before declaring the upload lost.
			if (!/not connected|connection closed|connection lost|timed out|session expired|unauthorized/i.test(error.message)) throw error;
		}
		if (finishResponse?.data?.ready) return finishResponse;
		const deadline = Date.now() + 15 * 60 * 1000;
		let missingPolls = 0;
		while (Date.now() < deadline) {
			await sleep(1000);
			let statusResponse;
			try {
				statusResponse = await this.request('firmware_upload_status', undefined, { timeout: 15000 });
			} catch (error) {
				// The client reconnect loop may still be restoring the transport and
				// token. Keep the server-side validation job intact and retry.
				if (/not connected|connection closed|connection lost|timed out|session expired|unauthorized/i.test(error.message)) continue;
				throw error;
			}
			const status = statusResponse?.data ?? {};
			if (status.ready) {
				if (!status.token && startToken) status.token = startToken;
				return { ...statusResponse, type: 'firmware_ready', data: status };
			}
			if (status.state === 'failed')
				throw new Error(status.error || 'Firmware validation failed');
			const missing = status.state === 'idle' ||
				(!status.state && !status.active && !status.ready && !status.validating);
			if (missing && ++missingPolls >= 5)
				throw new Error('The staged firmware upload is no longer available; upload the image again.');
			if (!missing) missingPolls = 0;
		onProgress?.({ phase: 'verifying', progress: 100, state: status.state ?? 'reconnecting' });
		}
		throw new Error('Firmware validation did not finish within 15 minutes; the staged job remains queryable from firmware status.');
	}

	beginFirmware(token) {
		return this.request('firmware_begin_flash', { token }, { timeout: 15000 });
	}

	#open() {
		if (this.stopped) return;
		this.onConnectionState?.(`Connecting to ${this.url}`);
		let socket;
		try { socket = new WebSocket(this.url, 'configd-ws'); }
		catch (error) {
			this.onConnectionState?.('WebSocket could not be created.');
			this.onError?.(error.message || 'WebSocket could not be created');
			return;
		}
		this.socket = socket;
		socket.onopen = async () => {
			this.reconnectDelay = 1000;
			if (socket.protocol !== 'configd-ws') {
				this.onConnectionState?.('WebSocket protocol mismatch.');
				this.onError?.(`Expected configd-ws protocol, received ${socket.protocol || 'none'}`);
				socket.close(1002, 'protocol mismatch');
				return;
			}
			this.onConnectionState?.('Connected; checking configd protocol.');
			try {
				const response = await this.request('hello', undefined, { timeout: 5000 });
				if (response.data?.service !== 'configd' || response.data?.protocol !== 2)
					throw new Error('Unexpected configd protocol response');
				this.onConnection?.(true);
				this.onConnectionState?.('Connected; authentication required.');
			} catch (error) {
				this.onConnection?.(false);
				this.onConnectionState?.('Connected, but configd protocol validation failed.');
				this.onError?.(error.message);
				socket.close(1002, 'configd hello failed');
			}
		};
		socket.onmessage = event => this.#handleMessage(event.data);
		socket.onerror = () => {
			this.onConnectionState?.('WebSocket handshake or transport failed.');
			this.onError?.(`WebSocket service is not reachable at ${this.url}`);
		};
		socket.onclose = event => {
			if (this.socket === socket) this.socket = null;
			this.onConnection?.(false);
			const detail = event.reason ? `: ${event.reason}` : '';
			this.onConnectionState?.(`Disconnected (code ${event.code})${detail}`);
			this.#rejectPending(new Error('Connection lost'));
			if (!this.stopped) {
				this.reconnectTimer = setTimeout(() => this.#open(), this.reconnectDelay);
				this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
			}
		};
	}

	#handleMessage(text) {
		let message;
		try { message = JSON.parse(text); }
		catch { this.onError?.('configd returned malformed JSON'); return; }
		if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
			this.onError?.('configd returned an invalid message'); return;
		}
		if (message.type === 'status') this.onStatus?.(message.data ?? {});
		if (message.type === 'config') this.onConfig?.(message.data ?? {});
		if (message.type === 'auth') this.onAuth?.(message.data ?? {});
		if (message.type === 'auth_required') { this.onConnectionState?.('Connected; authentication required.'); this.onAuthRequired?.(message.data ?? {}); }
		for (const listener of this.listeners.get(message.type) ?? []) listener(message.data ?? {}, message);
		if (message.id != null) {
			const pending = this.pending.get(String(message.id));
			if (pending) {
				clearTimeout(pending.timeout); this.pending.delete(String(message.id));
				if (message.type === 'error') pending.reject(new Error(message.data?.detail || message.data?.message || 'Bad Request'));
				else pending.resolve(message);
			}
		}
		if (message.type === 'error' && message.id == null)
			this.onError?.(message.data?.detail || message.data?.message || 'Bad Request');
	}

	#rejectPending(error) {
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timeout); pending.reject(error);
		}
		this.pending.clear();
	}
}
