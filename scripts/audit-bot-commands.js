#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const root = path.join(__dirname, '..')
const appPath = path.join(root, 'src', 'app.ts')
const commandsPath = path.join(root, 'src', 'helpers', 'botCommands.ts')
const localeDir = path.join(root, 'locales')

function uniq(values) {
  return [...new Set(values)]
}

function sorted(values) {
  return [...values].sort()
}

function difference(left, right) {
  const rightSet = new Set(right)
  return sorted(left.filter((value) => !rightSet.has(value)))
}

function quotedValues(text) {
  return [...text.matchAll(/'([^']+)'/g)].map((match) => match[1])
}

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

const appText = fs.readFileSync(appPath, 'utf8')
const commandsText = fs.readFileSync(commandsPath, 'utf8')

const appCommands = uniq(
  [...appText.matchAll(/bot\.command\(\s*['"]([a-z0-9_]+)['"]/g)].map(
    (match) => match[1]
  )
)
const publicCommands = uniq(
  [...commandsText.matchAll(/command:\s*'([a-z0-9_]+)'/g)].map(
    (match) => match[1]
  )
)
const hiddenBlock = commandsText.match(/hiddenBotCommands\s*=\s*\[([^\]]*)\]/s)
const hiddenCommands = hiddenBlock ? quotedValues(hiddenBlock[1]) : []

console.log(`Public commands: ${sorted(publicCommands).join(', ')}`)
console.log(`Hidden commands: ${sorted(hiddenCommands).join(', ')}`)
console.log(`Registered handlers: ${sorted(appCommands).join(', ')}`)

if (hiddenCommands.length) {
  fail(`Hidden commands are not allowed: ${hiddenCommands.join(', ')}`)
}

const missingHandlers = difference(publicCommands, appCommands)
const extraHandlers = difference(appCommands, publicCommands)

if (missingHandlers.length) {
  fail(`Commands listed but not registered: ${missingHandlers.join(', ')}`)
}
if (extraHandlers.length) {
  fail(`Commands registered but not listed: ${extraHandlers.join(', ')}`)
}

for (const file of ['en.yaml', 'ru.yaml']) {
  const localePath = path.join(localeDir, file)
  const locale = yaml.load(fs.readFileSync(localePath, 'utf8'))
  const help = String(locale.help || '').replace(/\\_/g, '_')
  const helpCommands = uniq(
    [...help.matchAll(/\/([a-z][a-z0-9_]*(?:_[a-z0-9]+)*)/g)].map(
      (match) => match[1]
    )
  )
  const missingHelp = difference(publicCommands, helpCommands)
  const hiddenInHelp = hiddenCommands.filter((command) =>
    helpCommands.includes(command)
  )

  console.log(`${file} help commands: ${sorted(helpCommands).join(', ')}`)

  if (missingHelp.length) {
    fail(`${file} help is missing public commands: ${missingHelp.join(', ')}`)
  }
  if (hiddenInHelp.length) {
    fail(`${file} help exposes hidden commands: ${hiddenInHelp.join(', ')}`)
  }
}

if (process.exitCode) {
  process.exit()
}
