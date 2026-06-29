import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []
const allowedRootMarkdown = new Set(['README.md', 'CONTRIBUTING.md', 'DOCUMENTATION-RULES.md'])
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.md') && !allowedRootMarkdown.has(entry.name)) {
    errors.push(`${entry.name}: move non-onboarding documentation under docs/`)
  }
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
for (const required of ['docs/README.md', 'DOCUMENTATION-RULES.md']) {
  if (!readme.includes(required)) errors.push(`README.md: missing link to ${required}`)
}

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'build', '.git'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

const historical = /\b(previous implementation|earlier implementation|old release|previous release|formerly|historically|was fixed|now fixed|regression fix|bug fix|hotfix|workaround|superseded implementation|migration-only instruction)\b/i
const linkPattern = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g
for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8')
  const rel = path.relative(root, file)
  const inHistory = rel.split(path.sep).includes('history')
  if (!inHistory && path.basename(file) !== 'DOCUMENTATION-RULES.md') {
    const match = text.match(historical)
    if (match) errors.push(`${rel}: historical narrative belongs under docs/history/: ${match[0]}`)
  }
  for (const match of text.matchAll(linkPattern)) {
    let target = match[1].trim().split(/\s+/, 1)[0].replace(/^<|>$/g, '')
    if (!target || target.startsWith('#') || /^(https?:|mailto:|data:)/.test(target)) continue
    target = decodeURIComponent(target.split('#', 1)[0].split('?', 1)[0])
    const resolved = path.resolve(path.dirname(file), target)
    if (resolved.startsWith(root) && !fs.existsSync(resolved)) errors.push(`${rel}: broken link: ${match[1]}`)
  }
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('Documentation links, root hygiene, and current/history separation are valid.')
