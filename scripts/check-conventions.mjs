#!/usr/bin/env node
/**
 * Conventions that are cheap to check and expensive to get wrong. Each one
 * is a mistake that actually happened in an app built on this stack.
 *
 * 1. Payload calls inside collection/global hooks pass `req`, so they run
 *    in the hook's transaction. Without it, a create in an afterChange
 *    hook cannot see the row being saved and an update deadlocks on it.
 * 2. Production compose files never give a credential a non-empty
 *    `:-default`, so a
 *    missing value stops the stack instead of creating a database with a
 *    known password.
 * 3. There is a health route (/api/health) for monitors and healthchecks.
 * 4. src/lib/scheduling stays framework-free (no payload, @payloadcms,
 *    next or react imports), so it can become a shared package later.
 *
 * Usage: node scripts/check-conventions.mjs [root]   (exit 1 on a violation)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.argv[2] ?? '.')
const problems = []
const rel = (p) => path.relative(root, p)

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p)
  }
  return out
}

/** Text of the argument list of the call whose '(' is at `open`. */
function callArgs(src, open) {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) return src.slice(open + 1, i)
  }
  return src.slice(open + 1)
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length

// 1. req in hook Payload calls
const OPS = 'find|findByID|count|create|update|delete|findGlobal|updateGlobal|duplicate'
const hookFiles = [...walk(path.join(root, 'src/collections')), ...walk(path.join(root, 'src/globals'))]
for (const file of hookFiles) {
  const src = readFileSync(file, 'utf8')
  const re = new RegExp(`req\\.payload\\.(${OPS})\\(`, 'g')
  for (let m; (m = re.exec(src)); ) {
    const args = callArgs(src, m.index + m[0].length - 1)
    if (!/(^|[\s{,])req(\s*[,}:]|\s*$)/m.test(args)) {
      problems.push(`${rel(file)}:${lineOf(src, m.index)}: req.payload.${m[1]}() in a hook without \`req\``)
    }
  }
}

// 2. no :-defaults on credentials in production compose files
const CREDENTIAL = /(PASSWORD|SECRET|TOKEN|API_KEY|USER)\b/
for (const name of readdirSync(root)) {
  if (!/^(docker-)?compose(\..+)?\.ya?ml$/.test(name) || /\.dev\./.test(name)) continue
  const src = readFileSync(path.join(root, name), 'utf8')
  // An empty default (${RESEND_API_KEY:-}) marks an optional value and is
  // fine; a non-empty one is a password nobody chose.
  for (const m of src.matchAll(/\$\{([A-Z0-9_]+):?-([^}]*)\}/g)) {
    if (CREDENTIAL.test(m[1]) && m[2] !== '') {
      problems.push(`${name}:${lineOf(src, m.index)}: \${${m[1]}} has a default; use \${${m[1]}:?...}`)
    }
  }
}

// 3. health route
const health = path.join(root, 'src/app/api/health/route.ts')
if (!existsSync(health) || !/export\s+(async\s+)?function\s+GET/.test(readFileSync(health, 'utf8'))) {
  problems.push('src/app/api/health/route.ts: missing, or has no GET handler')
}

// 4. scheduling boundary
for (const file of walk(path.join(root, 'src/lib/scheduling'))) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (/^(payload|@payloadcms\/|next($|\/)|react($|\/)|@\/)/.test(m[1])) {
      problems.push(`${rel(file)}:${lineOf(src, m.index)}: imports '${m[1]}'; lib/scheduling must stay framework-free`)
    }
  }
}

if (problems.length) {
  console.error(`check-conventions: ${problems.length} problem(s)\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('check-conventions: ok')
