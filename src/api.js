import { sha256Hex } from './crypto.js';

const DEFAULT_URL = import.meta.env.DEV
	? `ws://${location.host}/ws`
	: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:4001`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export class ConfigdClient {
	constructor({ url = DEFAULT_URL, onStatus, onConfig, onConnection, onAuth, onAuthRequired, onError } = {}) {
		this.url = url;
		this.onStatus = onStatus;
		this.onConfig = onConfig;
		this.onConnection = onConnection;
		this.onAuth = onAuth;
		this.onAuthRequired = onAuthRequired;
		this.onError = onError;
		this.socket = null;
		this.pending = new Map();
		this.nextId = 1;
		this.reconnectDelay = 1000;
		this.reconnectTimer = null;
		this.stopped = false;
	}

	connect() {
		this.stopped = false;
		this.#open();
	}

	close() {
		this.stopped = true;
		clearTimeout(this.reconnectTimer);
		this.socket?.close();
		this.socket = null;
		this.#rejectPending(new Error('Connection closed'));
	}

	request(type, data, { timeout = 10000 } = {}) {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error('WebSocket not connected'));
		}
		const id = String(this.nextId++);
		const message = { id, type };
		if (data !== undefined) message.data = data;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error('Request timed out'));
			}, timeout);
			this.pending.set(id, { resolve, reject, timeout: timer });
			try {
				this.socket.send(JSON.stringify(message));
			} catch (error) {
				clearTimeout(timer);
				this.pending.delete(id);
				reject(error);
			}
		});
	}

	authenticate(username, password) {
		return this.request('auth', { username, password }, { timeout: 15000 });
	}

	async uploadFirmware(file, { overlay = 'preserve', force = false, onProgress } = {}) {
		if (!file) throw new Error('Select a firmware image first');
		if (file.size <= 0 || file.size > 16 * 1024 * 1024) {
			throw new Error('Firmware must be no larger than 16 MiB');
		}
		onProgress?.({ phase: 'hashing', progress: 0, sent: 0, total: file.size });
		const sha256 = sha256Hex(new Uint8Array(await file.arrayBuffer()));
		await this.request('firmware_upload_start', {
			name: file.name,
			size: file.size,
			sha256,
			overlay,
			force,
		}, { timeout: 15000 });

		const chunkSize = 64 * 1024;
		let sent = 0;
		try {
			while (sent < file.size) {
				if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
					throw new Error('Connection lost during firmware upload');
				}
				const end = Math.min(sent + chunkSize, file.size);
				this.socket.send(await file.slice(sent, end).arrayBuffer());
				sent = end;
				while (this.socket.bufferedAmount > 512 * 1024) await sleep(20);
				onProgress?.({ phase: 'uploading', progress: Math.round(sent * 100 / file.size), sent, total: file.size });
			}
			const response = await this.request('firmware_upload_finish', undefined, { timeout: 30000 });
			onProgress?.({ phase: 'starting', progress: 100, sent, total: file.size });
			return response;
		} catch (error) {
			this.request('firmware_upload_cancel').catch(() => {});
			throw error;
		}
	}

	#open() {
		if (this.stopped) return;
		const socket = new WebSocket(this.url);
		this.socket = socket;
		socket.onopen = () => {
			this.reconnectDelay = 1000;
			this.onConnection?.(true);
		};
		socket.onmessage = event => this.#handleMessage(event.data);
		socket.onerror = () => this.onError?.('WebSocket connection failed');
		socket.onclose = () => {
			if (this.socket === socket) this.socket = null;
			this.onConnection?.(false);
			this.onAuthRequired?.();
			this.#rejectPending(new Error('Connection lost'));
			if (!this.stopped) {
				this.reconnectTimer = setTimeout(() => this.#open(), this.reconnectDelay);
				this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
			}
		};
	}

	#handleMessage(text) {
		let message;
		try {
			message = JSON.parse(text);
		} catch {
			this.onError?.('configd returned malformed JSON');
			return;
		}
		if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
			this.onError?.('configd returned an invalid message');
			return;
		}

		if (message.type === 'status') this.onStatus?.(message.data ?? {});
		if (message.type === 'config') this.onConfig?.(message.data ?? {});
		if (message.type === 'auth') this.onAuth?.(message.data ?? {});
		if (message.type === 'auth_required') this.onAuthRequired?.(message.data ?? {});

		if (message.id != null) {
			const pending = this.pending.get(String(message.id));
			if (pending) {
				clearTimeout(pending.timeout);
				this.pending.delete(String(message.id));
				if (message.type === 'error') {
					pending.reject(new Error(message.data?.detail || message.data?.message || 'Bad Request'));
				} else {
					pending.resolve(message);
				}
			}
		}
		if (message.type === 'error' && message.id == null) {
			this.onError?.(message.data?.detail || message.data?.message || 'Bad Request');
		}
	}

	#rejectPending(error) {
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timeout);
			pending.reject(error);
		}
		this.pending.clear();
	}
}
