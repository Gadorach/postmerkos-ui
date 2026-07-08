import { useEffect, useRef, useState } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

// Thin Preact wrapper over uPlot for the rich charts (temperature/load, backplane).
// `opts` is a uPlot options object minus width/height (caller should memoise it so
// the plot is not torn down every render); `data` is uPlot's [xvals, ...series].
// The plot auto-sizes to its container width via ResizeObserver.
// `xRange` ({min,max} in x-units) sets the visible window; `onXRange` is called
// whenever the user changes it (left-drag zoom, wheel zoom around the cursor, or
// right-drag pan) so the caller can keep several charts in sync.
export function Chart({ opts, data, height = 200, xRange, onXRange }) {
	const box = useRef(null);
	const plot = useRef(null);
	const onRange = useRef(onXRange);
	onRange.current = onXRange;
	useEffect(() => {
		const el = box.current;
		if (!el) return undefined;
		const width = el.clientWidth || 600;
		// setSelect only fires on a user drag-zoom, so programmatic scale changes
		// (init, setData, applying xRange) never get misreported as a user zoom.
		const hooks = {
			setSelect: [u => {
				if (!u.select || u.select.width <= 0) return;
				const min = u.posToVal(u.select.left, 'x');
				const max = u.posToVal(u.select.left + u.select.width, 'x');
				if (min != null && max != null && max > min) onRange.current?.({ min, max });
			}],
		};
		const u = new uPlot({ ...opts, width, height, hooks }, data ?? [[]], el);
		plot.current = u;
		const ro = new globalThis.ResizeObserver(() => {
			const w = el.clientWidth;
			if (w) u.setSize({ width: w, height });
		});
		ro.observe(el);

		const onWheel = event => {   // zoom x around the cursor
			event.preventDefault();
			const s = u.scales.x;
			if (s.min == null || s.max == null) return;
			const rect = u.over.getBoundingClientRect();
			const xval = u.posToVal(event.clientX - rect.left, 'x');
			const factor = event.deltaY < 0 ? 0.8 : 1.25;
			onRange.current?.({ min: xval - (xval - s.min) * factor, max: xval + (s.max - xval) * factor });
		};
		let pan = null;
		const onDown = event => {   // right-drag pan
			if (event.button !== 2) return;
			event.preventDefault();
			const s = u.scales.x;
			pan = { x: event.clientX, min: s.min, max: s.max, w: u.over.getBoundingClientRect().width };
		};
		const onMove = event => {
			if (!pan || pan.min == null) return;
			const span = pan.max - pan.min;
			const shift = -((event.clientX - pan.x) / pan.w) * span;
			onRange.current?.({ min: pan.min + shift, max: pan.max + shift });
		};
		const onUp = () => { pan = null; };
		const noMenu = event => event.preventDefault();
		u.over.addEventListener('wheel', onWheel, { passive: false });
		u.over.addEventListener('mousedown', onDown);
		u.over.addEventListener('contextmenu', noMenu);
		globalThis.addEventListener('mousemove', onMove);
		globalThis.addEventListener('mouseup', onUp);

		return () => {
			ro.disconnect();
			u.over.removeEventListener('wheel', onWheel);
			u.over.removeEventListener('mousedown', onDown);
			u.over.removeEventListener('contextmenu', noMenu);
			globalThis.removeEventListener('mousemove', onMove);
			globalThis.removeEventListener('mouseup', onUp);
			u.destroy();
			plot.current = null;
		};
	}, [opts, height]);
	useEffect(() => {
		const u = plot.current;
		if (!u || !data) return;
		u.setData(data);
		if (xRange && xRange.min != null && xRange.max != null)
			u.setScale('x', { min: xRange.min, max: xRange.max });
	}, [data, xRange]);
	return <div ref={box} className="chart" />;
}

// Responsive canvas sparkline for the per-port grid: fills its cell width (so tiles
// never overflow), auto-scales to its own max, and shows a hover tooltip with the
// timestamp + formatted value at the cursor. `times` are unix seconds aligned with
// `values`; `format` renders the value.
export function Sparkline({ values, times, name, color = '#3b82f6', height = 24, format = String }) {
	const wrap = useRef(null);
	const canvas = useRef(null);
	const [hover, setHover] = useState(null);
	useEffect(() => {
		const el = wrap.current; const c = canvas.current;
		if (!el || !c) return undefined;
		let width = el.clientWidth || 100;
		const draw = () => {
			const dpr = globalThis.devicePixelRatio || 1;
			c.width = width * dpr; c.height = height * dpr;
			const ctx = c.getContext('2d');
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, width, height);
			const n = values ? values.length : 0;
			if (n < 2) return;
			let max = 0;
			for (const v of values) if (v > max) max = v;
			if (max <= 0) max = 1;
			const t0 = times && times.length ? times[0] : 0;
			const tspan = times && times.length > 1 ? times[times.length - 1] - t0 : 0;
			const xOf = i => tspan > 0 ? ((times[i] - t0) / tspan) * width : (i / (n - 1)) * width;
			ctx.beginPath();
			let started = false;
			for (let i = 0; i < n; i++) {
				const v = values[i];
				if (v == null || Number.isFinite(v) === false) { started = false; continue; }  // gap: break the line
				const x = xOf(i);
				const y = height - (v / max) * (height - 2) - 1;
				if (started) ctx.lineTo(x, y); else { ctx.moveTo(x, y); started = true; }
			}
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			ctx.stroke();
		};
		draw();
		const ro = new globalThis.ResizeObserver(() => {
			const w = el.clientWidth;
			if (w && w !== width) { width = w; draw(); }
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, [values, times, color, height]);

	const onMove = event => {
		const el = wrap.current;
		const n = values ? values.length : 0;
		if (!el || n < 1) { setHover(null); return; }
		const rect = el.getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		setHover({ left: (event.clientX - rect.left), i: Math.round(frac * (n - 1)) });
	};
	const n = values ? values.length : 0;
	const hi = hover && hover.i >= 0 && hover.i < n ? hover : null;
	return <div className="ps-spark" ref={wrap} style={{ height: `${height}px` }}
		onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
		<canvas ref={canvas} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
		{hi && <div className="spark-tip" style={{ left: `${hi.left}px` }}>
			{name && <span className="tip-name">{name} </span>}
			{times && times[hi.i] != null && <span>{new Date(times[hi.i] * 1000).toLocaleTimeString([], { hour12: false })} </span>}
			<strong>{format(values[hi.i])}</strong>
		</div>}
	</div>;
}

// Mirrored per-port sparkline: TX (egress) drawn up from a centerline, RX
// (ingress) down. Auto-scales to the shared max; hover shows both directions.
export function MirrorSparkline({ rx, tx, times, name, height = 30, rxColor = '#22c55e', txColor = '#f59e0b', format = String }) {
	const wrap = useRef(null);
	const canvas = useRef(null);
	const [hover, setHover] = useState(null);
	useEffect(() => {
		const el = wrap.current; const c = canvas.current;
		if (!el || !c) return undefined;
		let width = el.clientWidth || 100;
		const draw = () => {
			const dpr = globalThis.devicePixelRatio || 1;
			c.width = width * dpr; c.height = height * dpr;
			const ctx = c.getContext('2d');
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, width, height);
			const mid = height / 2;
			ctx.strokeStyle = 'rgba(120,120,120,0.35)'; ctx.lineWidth = 1;
			ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(width, mid); ctx.stroke();
			const n = Math.min(rx ? rx.length : 0, tx ? tx.length : 0);
			if (n < 2) return;
			let max = 1;
			for (let i = 0; i < n; i++) { if (rx[i] > max) max = rx[i]; if (tx[i] > max) max = tx[i]; }
			const half = mid - 1;
			const t0 = times && times.length ? times[0] : 0;
			const tspan = times && times.length > 1 ? times[times.length - 1] - t0 : 0;
			const xOf = i => tspan > 0 ? ((times[i] - t0) / tspan) * width : (i / (n - 1)) * width;
			ctx.beginPath();
			let upStarted = false;
			for (let i = 0; i < n; i++) { const v = tx[i]; if (v == null || Number.isFinite(v) === false) { upStarted = false; continue; } const x = xOf(i); const y = mid - (v / max) * half; if (upStarted) ctx.lineTo(x, y); else { ctx.moveTo(x, y); upStarted = true; } }
			ctx.strokeStyle = txColor; ctx.stroke();
			ctx.beginPath();
			let dnStarted = false;
			for (let i = 0; i < n; i++) { const v = rx[i]; if (v == null || Number.isFinite(v) === false) { dnStarted = false; continue; } const x = xOf(i); const y = mid + (v / max) * half; if (dnStarted) ctx.lineTo(x, y); else { ctx.moveTo(x, y); dnStarted = true; } }
			ctx.strokeStyle = rxColor; ctx.stroke();
		};
		draw();
		const ro = new globalThis.ResizeObserver(() => { const w = el.clientWidth; if (w && w !== width) { width = w; draw(); } });
		ro.observe(el);
		return () => ro.disconnect();
	}, [rx, tx, times, height, rxColor, txColor]);
	const onMove = event => {
		const el = wrap.current;
		const n = Math.min(rx ? rx.length : 0, tx ? tx.length : 0);
		if (!el || n < 1) { setHover(null); return; }
		const rect = el.getBoundingClientRect();
		const frac = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
		setHover({ left: event.clientX - rect.left, i: Math.round(frac * (n - 1)) });
	};
	const n = Math.min(rx ? rx.length : 0, tx ? tx.length : 0);
	const hi = hover && hover.i >= 0 && hover.i < n ? hover : null;
	return <div className="ps-spark" ref={wrap} style={{ height: `${height}px` }}
		onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
		<canvas ref={canvas} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
		{hi && <div className="spark-tip" style={{ left: `${hi.left}px` }}>
			{name && <span className="tip-name">{name} </span>}
			{times && times[hi.i] != null && <span>{new Date(times[hi.i] * 1000).toLocaleTimeString([], { hour12: false })} </span>}
			<span style={{ color: txColor }}>&#8593; out {format(tx[hi.i])}</span> <span style={{ color: rxColor }}>&#8595; in {format(rx[hi.i])}</span>
		</div>}
	</div>;
}
