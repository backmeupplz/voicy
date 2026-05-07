const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const localeDir = path.join(root, 'locales')
const sourceDir = path.join(root, 'src')
const supportedLocaleFiles = [
  'de.yaml',
  'en.yaml',
  'es.yaml',
  'pt.yaml',
  'ru.yaml',
  'uk.yaml',
]

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

function localeValueLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line, index) => {
      const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
      return {
        lineNumber: index + 1,
        text: keyMatch ? keyMatch[2] : line,
      }
    })
}

function localeValues(filePath) {
  const values = []
  let currentValue

  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1
    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (keyMatch) {
      currentValue = {
        key: keyMatch[1],
        lineNumber,
        text: keyMatch[2],
      }
      values.push(currentValue)
      continue
    }

    if (currentValue) {
      currentValue.text += `\n${line}`
    }
  }

  return values
}

function unescapedCharacterCount(text, character) {
  let count = 0
  let previousCharacter = ''

  for (const currentCharacter of text) {
    if (currentCharacter === character && previousCharacter !== '\\') {
      count += 1
    }
    previousCharacter = currentCharacter
  }

  return count
}

function unmatchedMarkdownMarkers(text) {
  const markers = []
  const unescapedBackticks = unescapedCharacterCount(text, '`')
  const textWithoutCode = text.replace(/(^|[^\\])`[^`]*`/g, '$1')

  if (unescapedBackticks % 2 !== 0) {
    markers.push('`')
  }

  for (const marker of ['*', '_']) {
    if (unescapedCharacterCount(textWithoutCode, marker) % 2 !== 0) {
      markers.push(marker)
    }
  }

  return markers
}

function markdownSensitiveTokens(text) {
  return [
    ...text
      .replace(/`[^`]*`/g, '')
      .matchAll(/(^|[^\\])([@/#$]?[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+)\b/g),
  ].map((match) => match[2])
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
      /i18n\.t\(\s*[^,\n]+,\s*['"]([A-Za-z0-9_]+)['"]/g
    ),
  ].map((match) => match[1]),
  ...[
    ...sourceText.matchAll(/markdownI18n\([^,]+,\s*['"]([A-Za-z0-9_]+)['"]/g),
  ].map((match) => match[1]),
  ...[
    ...sourceText.matchAll(
      /localizedTranscriptionText\([^,]+,\s*['"]([A-Za-z0-9_]+)['"]/g
    ),
  ].map((match) => match[1]),
  ...[
    ...sourceText.matchAll(
      /transcriptionProgressStatus(?:Html|Line)\([^,]+,\s*['"]([A-Za-z0-9_]+)['"]/g
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
  'transcribe_all_true',
  'transcribe_all_false',
  'error_transcription_queue_full',
  'error_transcription_chat_limited',
  'error_transcription_user_limited',
  'golden_borodutch_subscription_required',
  'golden_borodutch_free_transcriptions_exhausted',
  'golden_borodutch_membership_check_failed',
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

  const unsafeMarkdownTokens = localeValueLines(path.join(localeDir, file))
    .map(({ lineNumber, text }) => ({
      lineNumber,
      tokens: markdownSensitiveTokens(text),
    }))
    .filter(({ tokens }) => tokens.length > 0)

  if (unsafeMarkdownTokens.length > 0) {
    hasFailures = true
    console.log(
      `  unsafe bare Markdown tokens: ${unsafeMarkdownTokens
        .map(({ lineNumber, tokens }) => `${lineNumber}: ${tokens.join(', ')}`)
        .join('; ')}`
    )
  }

  const unmatchedMarkers = localeValues(path.join(localeDir, file))
    .map(({ key, lineNumber, text }) => ({
      key,
      lineNumber,
      markers: unmatchedMarkdownMarkers(text),
    }))
    .filter(({ markers }) => markers.length > 0)

  if (unmatchedMarkers.length > 0) {
    hasFailures = true
    console.log(
      `  unmatched Markdown markers: ${unmatchedMarkers
        .map(
          ({ key, lineNumber, markers }) =>
            `${key} (${lineNumber}): ${markers.join(', ')}`
        )
        .join('; ')}`
    )
  }
}

if (hasFailures) {
  process.exitCode = 1
}
