#!/usr/bin/env node
/**
 * Pre-publish privacy sweep: fails if any tracked file names a real
 * person, business, host or address that must not be in this repository.
 *
 * The forbidden words are stored as SHA-256 hashes (of the lowercased
 * word, or of a two-word phrase joined by one space), so this public file
 * does not itself publish the names it guards against. Add one with:
 *   node scripts/check-pii.mjs --hash "some name"
 *
 * Also flags, by pattern: email addresses outside example/test domains,
 * Dutch phone numbers, and Dutch IBANs.
 *
 * Usage: node scripts/check-pii.mjs [root]   (exit 1 on a finding)
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const sha = (s) => createHash('sha256').update(s.toLowerCase()).digest('hex')

if (process.argv[2] === '--hash') {
  console.log(sha(process.argv.slice(3).join(' ').trim()))
  process.exit(0)
}

const DENY = new Set([
  '1083e3bb96bef882a9e4dbbd181f001757de606c8e518947cbeacf09eea1aaeb',
  'ddd3d3622fee61e059f144f3efe717eee4d6a7b12eb58195a3284af7f136fbf6',
  '8faa0bd00541fa7f48df5e171c83ca52a0049be9a354b98c778a47b86df93d24',
  '5cfab79049c893c14c1e455662261b8f9268005860f3b1833c3223ed2e390ca4',
  '935fcebda4d246199a0a37c416ff4902a973418664cc43566504ebd6cc01a905',
  '5b94841706a92922a6adbad41317d0915571f683b2f8343589e717dc6ea8889b',
  'c96623c777c68917ab60432ec64169bb1e519daf989e6843878f6ff1263889da',
  '49e34b8637d68ea133cd59d23cddcbabb2fdd391ec483f40576f2c69cea5302b',
  'e7231225a2ceb55002d2376c5777af455db58dba2d813a833ba2825f8a1d3217',
  '1dd4040f06112ae6a9db766f25d65452aa3eb3aaf318e29729ceac7f8c48cd45',
  '486166c494ff8fac76b8c57408e127d193a996c77fd8d429cbb394298f9f4ca4',
  '22e6a0cf815c1c0d804dbb3435b885cbb196b1ce28475ae1fee0147bd16635e8',
  '8ec0bfadaccf670e37cb70a773f3822cdaaf2f2d62621808a29595a913966f96',
])

const ALLOWED_EMAIL = /@([a-z0-9-]+\.)*(example\.(test|com|org|net)|[a-z0-9-]+\.test|localhost)$/i
const PATTERNS = [
  { name: 'email address', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, allow: (m) => ALLOWED_EMAIL.test(m) },
  { name: 'Dutch phone number', re: /(?<![\w.])(?:\+31[\s-]?|0031[\s-]?|0)6[\s-]?\d{8}(?!\d)/g },
  { name: 'Dutch IBAN', re: /\bNL\d{2}[A-Z]{4}\d{10}\b/g },
]

const root = path.resolve(process.argv[2] ?? '.')
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean)
  .filter((f) => !/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/i.test(f))

const findings = []
for (const file of files) {
  let text
  try {
    text = readFileSync(path.join(root, file), 'utf8')
  } catch {
    continue
  }
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    const words = line.toLowerCase().match(/[a-z0-9À-ɏ]+(?:-[a-z0-9À-ɏ]+)*/g) ?? []
    const candidates = new Set(words)
    for (let w = 0; w + 1 < words.length; w++) candidates.add(`${words[w]} ${words[w + 1]}`)
    for (const c of candidates) {
      if (DENY.has(sha(c))) findings.push(`${file}:${i + 1}: forbidden word or name`)
    }
    for (const p of PATTERNS) {
      for (const m of line.matchAll(p.re)) {
        if (!p.allow?.(m[0])) findings.push(`${file}:${i + 1}: ${p.name}`)
      }
    }
  })
}

if (findings.length) {
  console.error(`check-pii: ${findings.length} finding(s)\n  ${[...new Set(findings)].join('\n  ')}`)
  process.exit(1)
}
console.log(`check-pii: ok (${files.length} files)`)
