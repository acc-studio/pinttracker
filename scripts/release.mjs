// Usage: npm run release -- <patch|minor|major> "What's new (shown in the in-app update banner)"
// Bumps package.json, commits, creates an annotated tag with the note, and pushes.
// The pushed tag triggers .github/workflows/release.yml.
import { execFileSync } from 'node:child_process'

const [bump, ...rest] = process.argv.slice(2)
const notes = rest.join(' ').trim()
if (!['patch', 'minor', 'major'].includes(bump) || !notes) {
  console.error('Usage: npm run release -- <patch|minor|major> "What\'s new"')
  process.exit(1)
}
const git = (...args) => execFileSync('git', args, { stdio: 'inherit' })
if (execFileSync('git', ['status', '--porcelain']).toString().trim()) {
  console.error('Commit or stash your changes first.')
  process.exit(1)
}
const version = execFileSync('npm', ['version', bump, '--no-git-tag-version'], { shell: true }).toString().trim().replace(/^v/, '')
git('add', 'package.json', 'package-lock.json')
git('commit', '-m', `Release v${version}\n\n${notes}`)
git('tag', '-a', `v${version}`, '-m', notes)
git('push', 'origin', 'HEAD')
git('push', 'origin', `v${version}`)
console.log(`\nv${version} pushed. Follow the build: gh run watch`)
