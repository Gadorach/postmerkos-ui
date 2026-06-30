import assert from 'node:assert/strict';
import test from 'node:test';
import { splitPortBanks } from './port-layout.js';
const range = count => Array.from({ length: count }, (_, index) => index + 1);

test('MS42P desktop uses four twelve-port banks and one four-port SFP+ bank', () => {
	const layout = splitPortBanks(range(52), { copper_ports: 48, uplink_ports: 4, uplink: { label: 'SFP+' } }, false);
	assert.deepEqual(layout.copperBanks.map(bank => bank.label), ['1–12', '13–24', '25–36', '37–48']);
	assert.deepEqual(layout.uplinkPairs, [[49, 50], [51, 52]]);
	assert.equal(layout.uplinkLabel, 'SFP+');
});

test('phone mode splits each copper bank into groups of six', () => {
	const layout = splitPortBanks(range(52), { copper_ports: 48, uplink_ports: 4 }, true);
	assert.deepEqual(layout.copperBanks.map(bank => bank.label), ['1–6', '7–12', '13–18', '19–24', '25–30', '31–36', '37–42', '43–48']);
});

test('small platforms use explicit capabilities instead of port-count guessing', () => {
	const layout = splitPortBanks(range(10), { copper_ports: 8, uplink_ports: 2, uplink: { label: 'SFP' } }, false);
	assert.deepEqual(layout.copperBanks[0].ports, range(8));
	assert.deepEqual(layout.uplinkPairs, [[9, 10]]);
});
