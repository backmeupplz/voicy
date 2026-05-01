const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const localeDir = path.join(root, 'locales')
const sourceDir = path.join(root, 'src')
const supportedLocaleFiles = ['en.yaml', 'ru.yaml']

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

const directKeys = new Set([
  ...[...sourceText.matchAll(/i18n\.t\(\s*['"]([A-Za-z0-9_]+)['"]/g)].map(
    (match) => match[1]
  ),
  ...[
    ...sourceText.matchAll(
      /localizedTranscriptionText\([^,]+,\s*['"]([A-Za-z0-9_]+)['"]/g
    ),
  ].map((match) => match[1]),
])
const dynamicKeys = new Set([
  'files_false',
  'files_true',
  'lock_true',
  'lock_false',
  'silent_true',
  'silent_false',
  'timecodes_true',
  'timecodes_false',
  'transcribe_all_true',
  'transcribe_all_false',
])
const usedKeys = new Set([...directKeys, ...dynamicKeys])

let hasFailures = false

console.log(`Reference keys: ${referenceKeys.size}`)
console.log(`Used keys found in source: ${usedKeys.size}`)

const unexpectedFiles = files.filter(
  (file) => !supportedLocaleFiles.includes(file)
)
const missingFiles = supportedLocaleFiles.filter(
  (file) => !files.includes(file)
)

if (unexpectedFiles.length > 0) {
  hasFailures = true
  console.log(`Unsupported locale files: ${unexpectedFiles.join(', ')}`)
}

if (missingFiles.length > 0) {
  hasFailures = true
  console.log(`Missing supported locale files: ${missingFiles.join(', ')}`)
}

const missingReferenceKeys = [...usedKeys].filter(
  (key) => !referenceKeys.has(key)
)
if (missingReferenceKeys.length > 0) {
  hasFailures = true
  console.log(
    `Keys used in source but missing from en.yaml: ${missingReferenceKeys.join(
      ', '
    )}`
  )
}

for (const file of files) {
  const keys = localeKeys(path.join(localeDir, file))
  const staleKeys = keys.filter((key) => !usedKeys.has(key))
  const missingKeys = [...usedKeys].filter((key) => !keys.includes(key))

  if (staleKeys.length > 0) {
    hasFailures = true
  }

  if (missingKeys.length > 0) {
    hasFailures = true
  }

  console.log(
    `${file}: ${keys.length} keys, ${missingKeys.length} missing used keys, ${staleKeys.length} stale keys`
  )

  if (missingKeys.length > 0) {
    console.log(`  missing: ${missingKeys.join(', ')}`)
  }

  if (staleKeys.length > 0) {
    console.log(`  stale: ${staleKeys.join(', ')}`)
  }
}

if (hasFailures) {
  process.exitCode = 1
}
