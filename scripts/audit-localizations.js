const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const localeDir = path.join(root, 'locales')
const sourceDir = path.join(root, 'src')

function walk(dir) {
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    return fs.statSync(full).isDirectory() ? walk(full) : [full]
  })
}

function localeKeys(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => line.match(/^([A-Za-z0-9_]+):/))
    .filter(Boolean)
    .map((match) => match[1])
}

const files = fs
  .readdirSync(localeDir)
  .filter((file) => file.endsWith('.yaml'))
  .sort()

const referenceKeys = new Set(localeKeys(path.join(localeDir, 'en.yaml')))
const sourceText = walk(sourceDir)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')

const sourceStrings = new Set(
  [...sourceText.matchAll(/['"]([A-Za-z0-9_]+)['"]/g)].map((match) => match[1])
)
const usedKeys = new Set([...referenceKeys].filter((key) => sourceStrings.has(key)))

let hasStaleKeys = false

console.log(`Reference keys: ${referenceKeys.size}`)
console.log(`Used keys found in source: ${usedKeys.size}`)

for (const file of files) {
  const keys = localeKeys(path.join(localeDir, file))
  const staleKeys = keys.filter((key) => !usedKeys.has(key))
  const missingKeys = [...referenceKeys].filter((key) => !keys.includes(key))

  if (staleKeys.length > 0) {
    hasStaleKeys = true
  }

  console.log(
    `${file}: ${keys.length} keys, ${missingKeys.length} fallback keys, ${staleKeys.length} stale keys`
  )

  if (staleKeys.length > 0) {
    console.log(`  stale: ${staleKeys.join(', ')}`)
  }
}

if (hasStaleKeys) {
  process.exitCode = 1
}
