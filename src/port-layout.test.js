import assert from 'node:assert/strict';
import test from 'node:test';
import { splitPortBanks } from './port-layout.js';

const range = count => Array.from({ length: count }, (_, index) => index + 1);

test('MS42P is arranged as four 12-port copper banks followed by one SFP bank', () => {
	const layout = splitPortBanks(range(52));
	assert.deepEqual(layout.ethernetBanks.map(bank => [bank[0], bank.at(-1)]), [[1, 12], [13, 24], [25, 36], [37, 48]]);
	assert.deepEqual(layout.sfpPorts, [49, 50, 51, 52]);
});

test('28-port platforms retain two 12-port copper banks and a grouped four-port uplink bank', () => {
	const layout = splitPortBanks(range(28));
	assert.equal(layout.ethernetBanks.length, 2);
	assert.deepEqual(layout.ethernetBanks[1], range(24).slice(12));
	assert.deepEqual(layout.sfpPorts, [25, 26, 27, 28]);
});

test('compact platforms keep both uplinks together', () => {
	const layout = splitPortBanks(range(10));
	assert.deepEqual(layout.ethernetBanks, [[1, 2, 3, 4, 5, 6, 7, 8]]);
	assert.deepEqual(layout.sfpPorts, [9, 10]);
});
