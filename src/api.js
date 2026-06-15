const DEFAULT_URL = import.meta.env.DEV
	? `ws://${location.host}/ws`
	: `ws://${location.hostname}:4001`;

export class ConfigdClient {
	constructor({ url = DEFAULT_URL, onStatus, onConfig, onConnection, onError } = {}) {
		this.url = url;
		this.onStatus = onStatus;
		this.onConfig = onConfig;
		this.onConnection = onConnection;
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

	request(type, data) {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error('WebSocket not connected'));
		}
		const id = String(this.nextId++);
		const message = { id, type };
		if (data !== undefined) message.data = data;
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error('Request timed out'));
			}, 10000);
			this.pending.set(id, { resolve, reject, timeout });
			try {
				this.socket.send(JSON.stringify(message));
			} catch (error) {
				clearTimeout(timeout);
				this.pending.delete(id);
				reject(error);
			}
		});
	}

	#open() {
		if (this.stopped) return;
		const socket = new WebSocket(this.url);
		this.socket = socket;
		socket.onopen = () => {
			this.reconnectDelay = 1000;
			this.onConnection?.(true);
			this.request('get_config').catch(error => this.onError?.(error.message));
			this.request('get_status').catch(error => this.onError?.(error.message));
		};
		socket.onmessage = event => this.#handleMessage(event.data);
		socket.onerror = () => this.onError?.('WebSocket connection failed');
		socket.onclose = () => {
			if (this.socket === socket) this.socket = null;
			this.onConnection?.(false);
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
