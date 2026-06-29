import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTimezonePolicy, findTimezone, COMMON_TIMEZONES } from './timezones.js';

test('catalog contains broad common timezone coverage', () => {
	assert.ok(COMMON_TIMEZONES.length >= 90);
	assert.ok(findTimezone('America/Moncton'));
	assert.ok(findTimezone('Europe/London'));
	assert.ok(findTimezone('Asia/Kolkata'));
	assert.ok(findTimezone('Australia/Sydney'));
});

test('Moncton applies Atlantic standard and daylight offsets', () => {
	const policy = applyTimezonePolicy({ ntp_enabled: true, servers: ['pool.ntp.org'] }, 'America/Moncton');
	assert.equal(policy.standard_offset_minutes, -240);
	assert.equal(policy.dst.enabled, true);
	assert.equal(policy.dst.offset_minutes, -180);
	assert.equal(policy.dst.start.month, 3);
	assert.equal(policy.dst.end.month, 11);
});

test('fixed zones disable daylight saving', () => {
	const policy = applyTimezonePolicy({}, 'Asia/Tokyo');
	assert.equal(policy.standard_offset_minutes, 540);
	assert.equal(policy.dst.enabled, false);
});
