#!/usr/bin/env node

const fs = require('fs/promises')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    })
    const stdout = []
    const stderr = []

    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)))
    child.on('error', reject)
    child.on('close', (code) => {
      const output = Buffer.concat(stdout).toString('utf8')
      const errorOutput = Buffer.concat(stderr).toString('utf8')
      if (code !== 0) {
        reject(
          new Error(
            `${command} exited with ${code}: ${errorOutput || output}`.trim()
          )
        )
        return
      }
      resolve({ output, errorOutput })
    })
  })
}

async function main() {
  const workDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `voicy-whisper-transcriber-proof-${process.pid}-`)
  )
  const fakeWhisper = path.join(workDir, 'fake-whisper')
  const inputPath = path.join(workDir, 'input.wav')
  const outputPath = path.join(workDir, 'result.json')

  await fs.writeFile(inputPath, 'fake audio')
  await fs.writeFile(
    fakeWhisper,
    `#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const input = process.argv[2]
const outputDir = process.argv[process.argv.indexOf('--output_dir') + 1]
const language = process.argv.includes('--language')
  ? process.argv[process.argv.indexOf('--language') + 1]
  : 'en'
fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(
  path.join(outputDir, path.basename(input, path.extname(input)) + '.json'),
  JSON.stringify({
    text: 'proof transcript',
    language,
    segments: [{ start: 0, end: 1.5, text: 'proof transcript' }],
  })
)
`
  )
  await fs.chmod(fakeWhisper, 0o755)

  try {
    await run(
      process.execPath,
      ['scripts/whisper-transcriber.js', inputPath, outputPath, 'en'],
      {
        env: {
          ...process.env,
          PATH: '/usr/bin:/bin',
          VOICY_WHISPER_COMMAND: fakeWhisper,
        },
      }
    )

    const result = JSON.parse(await fs.readFile(outputPath, 'utf8'))
    assert(result.text === 'proof transcript', 'transcript text should match')
    assert(result.language === 'en', 'language should match')
    assert(
      result.metadata.command === fakeWhisper,
      'metadata should include command'
    )
    console.log('whisper transcriber proof passed')
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
