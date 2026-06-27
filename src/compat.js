const DEFAULT_REPO = 'Gadorach/meraki-builder';
const MAX_URL = 7000; // GitHub caps issue-creation URLs; stay well under.

export function buildIssueUrl(report) {
  const r = report || {};
  const repo = typeof r.project_repo === 'string' && r.project_repo.includes('/')
    ? r.project_repo : DEFAULT_REPO;
  const model = r.model || 'unknown';
  const firmware = r.firmware || 'unknown';
  const compat = r.compatibility || 'untested';

  const title = `[compat] ${model} — ${compat} (fw ${firmware})`;
  const labels = ['compatibility-report'];
  if (compat && compat !== 'confirmed') labels.push(compat);

  const checklist = [
    '## Compatibility report',
    '',
    `**Model:** ${model}  **Firmware:** ${firmware}  **Result:** ${compat}`,
    '',
    'Tester checklist (please verify and tick):',
    '- [ ] All ports forward traffic',
    '- [ ] PoE delivers power (if applicable)',
    '- [ ] Front-panel LEDs behave correctly',
    '- [ ] Management / web access reachable',
    '- [ ] Survives a reboot',
    '',
    'Notes:',
    '',
  ].join('\n');

  const json = JSON.stringify(r, null, 2);
  const make = body =>
    `https://github.com/${repo}/issues/new?` +
    `title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}` +
    `&labels=${encodeURIComponent(labels.join(','))}`;

  let url = make(`${checklist}\n\`\`\`json\n${json}\n\`\`\`\n`);
  if (url.length > MAX_URL) {
    url = make(`${checklist}\n_Report too large to inline — attach the downloaded JSON file._\n`);
  }
  return url;
}
