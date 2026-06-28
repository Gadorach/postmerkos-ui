import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIssueUrl } from './compat.js';

test('uses the report project_repo', () => {
  const url = buildIssueUrl({ model: 'MS320-48', firmware: '20260623', compatibility: 'untested', project_repo: 'Owner/Repo' });
  assert.ok(url.startsWith('https://github.com/Owner/Repo/issues/new?'));
});

test('defaults the repo when project_repo is missing', () => {
  const url = buildIssueUrl({ model: 'X', firmware: 'Y', compatibility: 'untested' });
  assert.ok(url.includes('/Gadorach/meraki-builder/issues/new'));
});

test('title carries model + firmware; labels include result', () => {
  const u = new URL(buildIssueUrl({ model: 'MS320-48', firmware: '20260623', compatibility: 'untested', project_repo: 'O/R' }));
  assert.match(u.searchParams.get('title'), /MS320-48/);
  assert.match(u.searchParams.get('title'), /20260623/);
  assert.match(u.searchParams.get('labels'), /compatibility-report/);
  assert.match(u.searchParams.get('labels'), /untested/);
  assert.match(u.searchParams.get('body'), /```json/);
});

test('confirmed adds no extra label', () => {
  const u = new URL(buildIssueUrl({ model: 'X', firmware: 'Y', compatibility: 'confirmed', project_repo: 'O/R' }));
  assert.equal(u.searchParams.get('labels'), 'compatibility-report');
});

test('omits inline JSON when the report is oversized', () => {
  const u = new URL(buildIssueUrl({ model: 'X', firmware: 'Y', compatibility: 'untested', project_repo: 'O/R', junk: 'x'.repeat(9000) }));
  assert.match(u.searchParams.get('body'), /too large/);
});
