import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chart, Sparkline, MirrorSparkline } from './chart';

// Retain up to ~3 h of samples at the 2 s cadence so the window can be widened
// back to when the graphs were opened; the visible window is sliced from this.
const MAX_SAMPLES = 5400;
const TEMP_COLORS = ['#ef4444', '#a855f7', '#0ea5e9', '#f59e0b', '#10b981', '#e11d48', '#6366f1', '#84cc16'];

const bps = (deltaBytes, dt) => (dt > 0 && deltaBytes >= 0 ? (deltaBytes * 8) / dt : 0);

const fmtRate = value => {
	const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
	let amount = value || 0; let unit = 0;
	while (amount >= 1000 && unit < units.length - 1) { amount /= 1000; unit++; }
	return `${amount >= 100 || unit === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[unit]}`;
};
const fmtWatts = value => `${(value || 0).toFixed(2)} W`;
const fmtTemp = value => (value == null ? '--' : `${value.toFixed(1)} °C`);
const fmtLoad = value => (value == null ? '--' : value.toFixed(2));
const fmtPct = value => (value == null ? '--' : `${value.toFixed(0)}%`);
const fmtClock = seconds => new Date(seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const wattAxisValues = (u, splits) => splits.map(v => `${v} W`);
const clockAxisValues = (u, splits) => splits.map(fmtClock);

// uPlot legend value: hovered sample when the cursor is on the plot, else latest.
const seriesValue = fmt => (u, v, seriesIdx, idx) => {
	const data = u.data[seriesIdx];
	const raw = idx == null ? (data && data.length ? data[data.length - 1] : null) : v;
	return fmt(raw);
};

// Time-windowed moving average: each point is the mean of all samples within
// +/- windowSec/2 (by timestamp t, ascending). Cadence/gap-independent, O(n) via
// a sliding window, null/non-finite preserving. windowSec<=0 returns input.
function smoothSeries(t, arr, windowSec) {
	if (arr == null || windowSec <= 0 || arr.length < 3) return arr;
	const n = arr.length, half = windowSec / 2;
	const finite = v => typeof v === 'number' && Number.isFinite(v);
	const out = new Array(n);
	let lo = 0, hi = 0, sum = 0, cnt = 0;
	for (let i = 0; i < n; i++) {
		const tmax = t[i] + half;
		while (hi < n && t[hi] <= tmax) { const v = arr[hi]; if (finite(v)) { sum += v; cnt++; } hi++; }
		const tmin = t[i] - half;
		while (lo < hi && t[lo] < tmin) { const v = arr[lo]; if (finite(v)) { sum -= v; cnt--; } lo++; }
		out[i] = cnt > 0 ? sum / cnt : null;
	}
	return out;
}

// Median sample interval over the recent tail (fallback 2s), for gap detection.
function typicalDt(t) {
	if (t.length < 3) return 2;
	const d = [];
	for (let i = Math.max(1, t.length - 100); i < t.length; i++) d.push(t[i] - t[i - 1]);
	d.sort((a, z) => a - z);
	return d[d.length >> 1] || 2;
}
// Insert vals[k] before original index at[k] (at ascending) into a copy of arr.
// Used to drop a null (line break) into real time gaps so lines are not bridged.
function spliceInserts(arr, at, vals) {
	if (!at.length) return arr;
	const out = []; let j = 0;
	for (let i = 0; i < arr.length; i++) {
		while (j < at.length && at[j] === i) out.push(vals[j++]);
		out.push(arr[i]);
	}
	while (j < at.length) out.push(vals[j++]);
	return out;
}

// Persist a rolling window of the full telemetry history (incl. per-port) to
// sessionStorage so a page reload restores the graphs. Survives reload/navigation
// within the tab (cleared when the tab closes). Values are rounded on save to keep
// the JSON compact - ~1-2 MB for one hour of all series, well under the ~5 MB quota.
const STORE_KEY = 'pmos.graphs.v1';
const PERSIST_SECONDS = 3600;   // rolling window kept in sessionStorage (1 h)
const PERSIST_MS = 30000;       // write cadence
const rInt = v => (v == null ? null : Math.round(v));
const r1 = v => (v == null ? null : Math.round(v * 10) / 10);
const r2 = v => (v == null ? null : Math.round(v * 100) / 100);

function persistGraphs({ buf, tempRings, portRx, portTx, portP, portMeta, prev }) {
	try {
		const store = globalThis.sessionStorage;
		if (!store) return;
		const t = buf.t;
		if (!t.length) return;
		const cutoff = t[t.length - 1] - PERSIST_SECONDS;
		let s = 0; while (s < t.length && t[s] < cutoff) s++;
		const payload = {
			v: 1,
			t: t.slice(s).map(r1),
			load: buf.load.slice(s).map(r2), mem: buf.mem.slice(s).map(r1),
			rx: buf.rx.slice(s).map(rInt), tx: buf.tx.slice(s).map(rInt), poe: buf.poe.slice(s).map(r2),
			temps: Object.fromEntries([...tempRings].map(([n, a]) => [n, a.slice(s).map(r1)])),
			ports: Object.fromEntries([...portRx].map(([i, a]) => [i, {
				rx: a.slice(s).map(rInt), tx: (portTx.get(i) ?? []).slice(s).map(rInt), p: (portP.get(i) ?? []).slice(s).map(r2),
				up: portMeta.get(i)?.up ? 1 : 0, spd: portMeta.get(i)?.spd ?? 0,
			}])),
			prev: { total: prev.total, ports: [...prev.ports] },
		};
		store.setItem(STORE_KEY, JSON.stringify(payload));
	} catch { /* quota exceeded / storage unavailable: skip this cycle */ }
}

// Rehydrate the refs in place from sessionStorage. Returns true on success.
function restoreGraphs({ buf, tempRings, portRx, portTx, portP, portMeta, prev }) {
	try {
		const raw = globalThis.sessionStorage?.getItem(STORE_KEY);
		if (!raw) return false;
		const d = JSON.parse(raw);
		if (!d || d.v !== 1 || !Array.isArray(d.t) || !d.t.length) return false;
		buf.t = d.t; buf.load = d.load; buf.mem = d.mem;
		buf.rx = d.rx; buf.tx = d.tx; buf.poe = d.poe;
		tempRings.clear();
		for (const [n, a] of Object.entries(d.temps ?? {})) tempRings.set(n, a);
		portRx.clear(); portTx.clear(); portP.clear(); portMeta.clear();
		for (const [i, o] of Object.entries(d.ports ?? {})) {
			const pi = Number(i);
			portRx.set(pi, o.rx); portTx.set(pi, o.tx); portP.set(pi, o.p);
			portMeta.set(pi, { up: !!o.up, spd: o.spd });
		}
		prev.total = d.prev?.total ?? null;
		prev.ports = new Map((d.prev?.ports ?? []).map(([i, val]) => [Number(i), val]));
		return true;
	} catch { return false; }
}

export default function GraphsPane({ client, config }) {
	const buf = useRef({ t: [], load: [], mem: [], rx: [], tx: [], poe: [] });
	const prev = useRef({ ports: new Map(), total: null });
	const tempRings = useRef(new Map());   // sensor name -> temp ring (aligned with buf.t)
	const portRx = useRef(new Map());      // port -> ingress bit-rate ring
	const portTx = useRef(new Map());      // port -> egress bit-rate ring
	const portP = useRef(new Map());       // port -> PoE watt ring
	const portMeta = useRef(new Map());    // port -> { up, spd }
	const [head, setHead] = useState({});
	const [tempNames, setTempNames] = useState([]);
	const [metric, setMetric] = useState({ tput: true, poe: false });
	const [hasPoe, setHasPoe] = useState(false);   // device exposes PoE (frame carries poe_w)
	const [windowMin, setWindowMin] = useState(1);
	const [view, setView] = useState(null);
	const [selectedPort, setSelectedPort] = useState(null);   // port whose detail chart is expanded
	const [smoothSec, setSmoothSec] = useState(0);   // moving-average window (seconds); 0 = off
	const [, bump] = useState(0);

	useEffect(() => {
		let alive = true;
		const refs = { buf: buf.current, tempRings: tempRings.current, portRx: portRx.current, portTx: portTx.current, portP: portP.current, portMeta: portMeta.current, prev: prev.current };
		if (restoreGraphs(refs)) {
			setTempNames([...tempRings.current.keys()]);
			if (buf.current.poe.some(v => v != null)) setHasPoe(true);
			bump(v => v + 1);
		}
		const onFrame = data => {
			if (!alive) return;
			const now = Date.now() / 1000;
			const b = buf.current;
			b.t.push(now);
			const len = b.t.length;

			const load = Array.isArray(data.load) ? data.load : [];
			b.load.push(load.length ? load[0] : null);
			const memPct = data.mem_total_kb > 0 && data.mem_avail_kb != null
				? ((data.mem_total_kb - data.mem_avail_kb) / data.mem_total_kb) * 100 : null;
			b.mem.push(memPct);

			// Per-sensor temperatures (aligned rings; backfill new sensors).
			const temps = Array.isArray(data.temps) ? data.temps : [];
			for (const s of temps) if (!tempRings.current.has(s.name)) tempRings.current.set(s.name, new Array(len - 1).fill(null));
			const tmap = new Map(temps.map(s => [s.name, s.c]));
			for (const [name, ring] of tempRings.current) ring.push(tmap.has(name) ? tmap.get(name) : null);

			let rxRate = 0; let txRate = 0;
			if (data.total && prev.current.total) {
				const dt = now - prev.current.total.t;
				rxRate = bps(data.total.rxB - prev.current.total.rxB, dt);
				txRate = bps(data.total.txB - prev.current.total.txB, dt);
			}
			if (data.total) prev.current.total = { rxB: data.total.rxB, txB: data.total.txB, t: now };
			b.rx.push(rxRate); b.tx.push(txRate);
			b.poe.push(data.poe_w ?? null);
			if (data.poe_w != null) setHasPoe(true);

			const list = data.ports ?? [];
			for (const p of list) {
				if (!portRx.current.has(p.i)) {
					portRx.current.set(p.i, new Array(len - 1).fill(0));
					portTx.current.set(p.i, new Array(len - 1).fill(0));
					portP.current.set(p.i, new Array(len - 1).fill(0));
				}
			}
			const frameMap = new Map(list.map(p => [p.i, p]));
			for (const [i, ringRx] of portRx.current) {
				const p = frameMap.get(i);
				let rx = 0; let tx = 0;
				if (p) {
					const pr = prev.current.ports.get(i);
					if (pr) { const dt = now - pr.t; rx = bps(p.rxB - pr.rxB, dt); tx = bps(p.txB - pr.txB, dt); }
					prev.current.ports.set(i, { rxB: p.rxB, txB: p.txB, t: now });
					portMeta.current.set(i, { up: !!p.up, spd: p.spd });
				}
				ringRx.push(rx);
				portTx.current.get(i).push(tx);
				portP.current.get(i).push(p ? (p.poeW ?? 0) : 0);
			}

			if (b.t.length > MAX_SAMPLES) {
				const over = b.t.length - MAX_SAMPLES;
				for (const k of ['t', 'load', 'mem', 'rx', 'tx', 'poe']) b[k].splice(0, over);
				for (const a of tempRings.current.values()) a.splice(0, over);
				for (const m of [portRx.current, portTx.current, portP.current]) for (const a of m.values()) a.splice(0, over);
			}

			setTempNames([...tempRings.current.keys()]);
			setHead({
				temps, load: load.length ? load[0] : null, mem: memPct,
				poe: data.poe_w ?? null, rx: rxRate, tx: txRate,
			});
			bump(v => v + 1);
		};
		const unlisten = client.subscribe('telemetry', onFrame);
		client.telemetrySubscribe().catch(() => {});
		const save = () => persistGraphs(refs);
		const saveTimer = globalThis.setInterval(save, PERSIST_MS);
		const onHide = () => { if (globalThis.document?.visibilityState === 'hidden') save(); };
		globalThis.document?.addEventListener('visibilitychange', onHide);
		return () => {
			alive = false; unlisten(); client.telemetryUnsubscribe();
			globalThis.clearInterval(saveTimer);
			globalThis.document?.removeEventListener('visibilitychange', onHide);
			save();
		};
	}, [client]);

	const loadMemOpts = useMemo(() => ({
		scales: { x: { time: true }, load: {}, mem: { range: [0, 100] } },
		series: [
			{ value: seriesValue(v => (v == null ? '--' : fmtClock(v))) },
			{ label: 'Load (1m)', stroke: '#3b82f6', scale: 'load', value: seriesValue(fmtLoad) },
			{ label: 'Mem used', stroke: '#14b8a6', scale: 'mem', value: seriesValue(fmtPct) },
		],
		axes: [{ values: clockAxisValues }, { scale: 'load', stroke: '#3b82f6', size: 48 }, { scale: 'mem', side: 1, stroke: '#14b8a6', size: 46, values: (u, s) => s.map(v => `${v}%`) }],
	}), []);
	const tempsOpts = useMemo(() => ({
		scales: { x: { time: true }, c: {} },
		series: [
			{ value: seriesValue(v => (v == null ? '--' : fmtClock(v))) },
			...tempNames.map((name, i) => ({ label: name, stroke: TEMP_COLORS[i % TEMP_COLORS.length], scale: 'c', value: seriesValue(fmtTemp) })),
		],
		axes: [{ values: clockAxisValues }, { scale: 'c', size: 52, values: (u, s) => s.map(v => `${v}°`) }],
	}), [tempNames.join(',')]);
	const backplaneOpts = useMemo(() => ({
		scales: {
			x: { time: true },
			rate: { range: (u, dmin, dmax) => { const m = Math.max(Math.abs(dmin), Math.abs(dmax), 1); return [-m, m]; } },
			...(hasPoe ? { poe: {} } : {}),
		},
		series: [
			{ value: seriesValue(v => (v == null ? '--' : fmtClock(v))) },
			{ label: 'RX (in)', stroke: '#22c55e', fill: 'rgba(34,197,94,0.12)', scale: 'rate', value: seriesValue(v => fmtRate(Math.abs(v ?? 0))) },
			{ label: 'TX (out)', stroke: '#f59e0b', fill: 'rgba(245,158,11,0.12)', scale: 'rate', value: seriesValue(fmtRate) },
			...(hasPoe ? [{ label: 'PoE', stroke: '#a855f7', scale: 'poe', value: seriesValue(fmtWatts) }] : []),
		],
		axes: [
			{ values: clockAxisValues },
			{ scale: 'rate', values: (u, splits) => splits.map(v => fmtRate(Math.abs(v))), size: 78 },
			...(hasPoe ? [{ scale: 'poe', side: 1, values: wattAxisValues, size: 54 }] : []),
		],
	}), [hasPoe]);
	// Expanded single-port chart (click a mini tile): mirrored in/out + optional PoE.
	const portOpts = useMemo(() => ({
		scales: {
			x: { time: true },
			rate: { range: (u, dmin, dmax) => { const m = Math.max(Math.abs(dmin), Math.abs(dmax), 1); return [-m, m]; } },
			...(hasPoe ? { poe: {} } : {}),
		},
		series: [
			{ value: seriesValue(v => (v == null ? '--' : fmtClock(v))) },
			{ label: 'In (rx)', stroke: '#22c55e', fill: 'rgba(34,197,94,0.12)', scale: 'rate', value: seriesValue(v => fmtRate(Math.abs(v ?? 0))) },
			{ label: 'Out (tx)', stroke: '#f59e0b', fill: 'rgba(245,158,11,0.12)', scale: 'rate', value: seriesValue(fmtRate) },
			...(hasPoe ? [{ label: 'PoE', stroke: '#a855f7', scale: 'poe', value: seriesValue(fmtWatts) }] : []),
		],
		axes: [
			{ values: clockAxisValues },
			{ scale: 'rate', values: (u, splits) => splits.map(v => fmtRate(Math.abs(v))), size: 78 },
			...(hasPoe ? [{ scale: 'poe', side: 1, values: wattAxisValues, size: 54 }] : []),
		],
	}), [hasPoe]);

	const b = buf.current;
	const lastT = b.t.length ? b.t[b.t.length - 1] : 0;
	const liveRange = { min: lastT - windowMin * 60, max: lastT };
	const xRange = view ?? liveRange;
	let s0 = 0; while (s0 < b.t.length && b.t[s0] < xRange.min) s0++;
	let s1 = b.t.length; while (s1 > s0 && b.t[s1 - 1] > xRange.max) s1--;
	const sliceR = arr => arr.slice(s0, s1);
	const times = sliceR(b.t);
	// Smoothing over the chosen seconds. smF: full-array charts (x = b.t);
	// smS: per-port sparklines (x = the sliced times). No-op when smoothSec = 0.
	const smF = smoothSec > 0 ? (a => smoothSeries(b.t, a, smoothSec)) : (a => a);
	const smS = smoothSec > 0 ? (a => smoothSeries(times, a, smoothSec)) : (a => a);
	// Break lines across real time gaps (missed samples / reloads) rather than
	// bridging them: augT gets a synthetic timestamp in each gap, gy() drops a
	// null there for every series so uPlot leaves a blank.
	const dt0 = typicalDt(b.t);
	const gapAt = [], gapTime = [];
	for (let i = 1; i < b.t.length; i++) {
		const dt = b.t[i] - b.t[i - 1];
		if (dt > Math.max(5, dt0 * 3)) { gapAt.push(i); gapTime.push(b.t[i - 1] + Math.min(dt0, dt / 2)); }
	}
	const augT = spliceInserts(b.t, gapAt, gapTime);
	const gNull = gapAt.map(() => null);
	const gy = arr => spliceInserts(arr, gapAt, gNull);
	// Same gap breaks for the per-port sparklines, computed in the sliced (window)
	// space they render in so their nulls line up with the sliced times.
	const sGapAt = [], sGapTime = [];
	for (let i = 1; i < times.length; i++) {
		const dt = times[i] - times[i - 1];
		if (dt > Math.max(5, dt0 * 3)) { sGapAt.push(i); sGapTime.push(times[i - 1] + Math.min(dt0, dt / 2)); }
	}
	const augTS = spliceInserts(times, sGapAt, sGapTime);
	const sNull = sGapAt.map(() => null);
	const gyS = arr => spliceInserts(arr, sGapAt, sNull);
	const rxNeg = b.rx.map(v => -v);
	const maxTemp = (head.temps ?? []).reduce((m, s) => (s.c > m ? s.c : m), null);
	const order = [...portMeta.current.keys()].sort((a, z) => a - z);
	const setWindow = minutes => { setWindowMin(minutes); setView(null); };

	return <div className="graphs-pane">
		<div className="graph-controls">
			<div className="graph-head">
				<span>Temp: <strong>{fmtTemp(maxTemp)}</strong></span>
				<span>Load: <strong>{fmtLoad(head.load)}</strong></span>
				<span>Mem: <strong>{fmtPct(head.mem)}</strong></span>
				<span>Backplane: <strong>{fmtRate((head.rx || 0) + (head.tx || 0))}</strong></span>
				{hasPoe && <span>PoE: <strong>{fmtWatts(head.poe)}</strong></span>}
			</div>
			<div className="graph-nav">
				<label className="win-input" title="Moving-average window in seconds (0 = off)">Smooth (s):
					<input type="number" min="0" step="5" value={smoothSec}
						onInput={e => setSmoothSec(Math.max(0, Number(e.currentTarget.value) || 0))}
						onWheel={e => { e.preventDefault(); setSmoothSec(v => Math.max(0, v + (e.deltaY < 0 ? 5 : -5))); }} />
				</label>
				<button className="btn-secondary" onClick={() => setView(null)} disabled={!view} title="Resume following live data">Live</button>
				<label className="win-input">Window (min):
					<input type="number" min="1" step="1" value={windowMin}
						onInput={e => setWindow(Math.max(1, Number(e.currentTarget.value) || 1))}
						onWheel={e => { e.preventDefault(); setWindowMin(v => Math.max(1, v + (e.deltaY < 0 ? 1 : -1))); setView(null); }} />
				</label>
			</div>
		</div>
		<div className="graph-row">
			<section><h3>CPU load &amp; memory</h3><Chart opts={loadMemOpts} data={[augT, gy(smF(b.load)), gy(smF(b.mem))]} xRange={xRange} onXRange={setView} /></section>
			<section><h3>Temperatures</h3><Chart opts={tempsOpts} data={[augT, ...tempNames.map(n => gy(smF(tempRings.current.get(n) ?? [])))]} xRange={xRange} onXRange={setView} /></section>
			<section><h3>Backplane throughput{hasPoe ? ' & PoE' : ''}</h3><Chart opts={backplaneOpts} data={hasPoe ? [augT, gy(smF(rxNeg)), gy(smF(b.tx)), gy(smF(b.poe))] : [augT, gy(smF(rxNeg)), gy(smF(b.tx))]} xRange={xRange} onXRange={setView} /></section>
		</div>
		<section>
			<div className="spark-head">
				<h3>Per-port</h3>
				<label className="checkbox-line"><input type="checkbox" checked={metric.tput} onInput={e => setMetric(m => ({ ...m, tput: e.currentTarget.checked }))} /> Throughput (in/out)</label>
				{hasPoe && <label className="checkbox-line"><input type="checkbox" checked={metric.poe} onInput={e => setMetric(m => ({ ...m, poe: e.currentTarget.checked }))} /> PoE</label>}
			</div>
			{order.length === 0 && <p className="notice">Waiting for the first samples…</p>}
			<div className="port-spark-grid">
				{order.map(i => {
					const meta = portMeta.current.get(i) ?? {};
					const name = (config?.ports?.[i] ?? config?.ports?.[String(i)])?.name || '';
					const label = name ? `port ${i} · ${name}` : `port ${i}`;
					const rx = sliceR(portRx.current.get(i) ?? []);
					const tx = sliceR(portTx.current.get(i) ?? []);
					const poe = sliceR(portP.current.get(i) ?? []);
					const lastTput = (rx.length ? rx[rx.length - 1] : 0) + (tx.length ? tx[tx.length - 1] : 0);
					const lastPoe = poe.length ? poe[poe.length - 1] : 0;
					return <div className={`port-spark${meta.up ? '' : ' down'}${selectedPort === i ? ' selected' : ''}`} key={i} title={`${label} (click to expand)`} onClick={() => setSelectedPort(p => (p === i ? null : i))}>
						<div className="ps-top">
							<span className="ps-port">{i}</span>
							<div className="ps-body">
								{metric.tput && <div className="ps-line">
									<MirrorSparkline rx={gyS(smS(rx))} tx={gyS(smS(tx))} times={augTS} name={label} format={fmtRate} />
									<span className="ps-rate">{fmtRate(lastTput)}</span>
								</div>}
								{metric.poe && <div className="ps-line">
									<Sparkline values={gyS(smS(poe))} times={augTS} name={label} color="#a855f7" format={fmtWatts} />
									<span className="ps-rate">{fmtWatts(lastPoe)}</span>
								</div>}
								{!metric.tput && !metric.poe && <span className="ps-rate">--</span>}
							</div>
						</div>
						<span className="ps-name">{name || ' '}</span>
					</div>;
				})}
			</div>
		</section>
		{selectedPort != null && portMeta.current.has(selectedPort) && (() => {
			const name = (config?.ports?.[selectedPort] ?? config?.ports?.[String(selectedPort)])?.name || '';
			const label = name ? `Port ${selectedPort} · ${name}` : `Port ${selectedPort}`;
			const selRxNeg = (portRx.current.get(selectedPort) ?? []).map(v => -v);
			const selTx = portTx.current.get(selectedPort) ?? [];
			const selPoe = portP.current.get(selectedPort) ?? [];
			const data = hasPoe ? [augT, gy(smF(selRxNeg)), gy(smF(selTx)), gy(smF(selPoe))] : [augT, gy(smF(selRxNeg)), gy(smF(selTx))];
			return <section className="port-detail">
				<div className="spark-head">
					<h3>{label} · throughput{hasPoe ? ' & PoE' : ''}</h3>
					<button className="btn-secondary" onClick={() => setSelectedPort(null)}>Close</button>
				</div>
				<Chart opts={portOpts} data={data} xRange={xRange} onXRange={setView} />
			</section>;
		})()}
	</div>;
}
