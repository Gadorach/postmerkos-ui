import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');

test('mobile layout disables front-page All Ports without erasing desktop preference', () => {
	const index = source('./index.jsx');
	assert.match(index, /effectiveFrontTable\s*=\s*frontTable\s*&&\s*!phone/);
	assert.match(index, /localStorage\.getItem\('pmos\.frontTable'\)\s*===\s*'1'/);
});

test('mobile focused editor is accordion based and All Ports becomes a selector', () => {
	const menus = source('./menus.jsx');
	const mobile = source('./mobile-port-editor.jsx');
	assert.match(menus, /phone\s*\?\s*<MobilePortEditor/);
	assert.match(menus, /mobile-port-selector/);
	for (const section of ['Overview', 'Basic settings', 'Power over Ethernet', 'VLAN', 'Spanning Tree', 'Clients'])
		assert.match(mobile, new RegExp(`summary>${section.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
	assert.match(mobile, /mobile-setting-card/);
});

test('port banks, labels, SFP pairs, and mobile six-port geometry are declared', () => {
	const ports = source('./ports.jsx');
	const layout = source('./port-layout.js');
	const css = source('./style.css');
	assert.match(ports, /<fieldset className="port-bank copper-bank"/);
	assert.match(ports, /<legend>{bank\.label}<\/legend>/);
	assert.match(ports, /className="sfp-pair"/);
	assert.match(layout, /phone\s*\?\s*6\s*:\s*12/);
	assert.match(css, /grid-template-columns:\s*repeat\(3, var\(--tile-size\)\)/);
	assert.match(css, /\.sfp-pair \{ display: flex; flex: 0 0 auto; \}/);
});

test('header, login, All Ports and desktop name-column preferences match the approved design', () => {
	const index = source('./index.jsx');
	const login = source('./login.jsx');
	const allPorts = source('./all-ports.jsx');
	const table = source('./table.jsx');
	for (const card of ['postmerkOS', 'Device', 'Address', 'Time', 'Temperatures', 'Session', 'Tools', 'Account'])
		assert.match(index, new RegExp(card));
	assert.match(login, /Remember me on this device/);
	assert.match(login, /login-status/);
	assert.match(login, /pmos\.rememberLogin/);
	assert.match(allPorts, /Clone selected port/);
	assert.match(allPorts, /Show port names/);
	assert.match(table, /showName\s*=\s*false/);
});
