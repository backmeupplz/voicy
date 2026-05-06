import { publicBotCommands } from '@/helpers/botCommands'
import bot from '@/helpers/bot'

const commandLocales = [
  { languageCode: undefined, descriptionKey: 'description' },
  { languageCode: 'de', descriptionKey: 'germanDescription' },
  { languageCode: 'es', descriptionKey: 'spanishDescription' },
  { languageCode: 'pt', descriptionKey: 'portugueseDescription' },
  { languageCode: 'ru', descriptionKey: 'russianDescription' },
  { languageCode: 'uk', descriptionKey: 'ukrainianDescription' },
] as const

function commandsForLocale(
  descriptionKey: (typeof commandLocales)[number]['descriptionKey']
) {
  return publicBotCommands.map((definition) => ({
    command: definition.command,
    description: definition[descriptionKey],
  }))
}

function setCommands({
  languageCode,
  descriptionKey,
}: (typeof commandLocales)[number]) {
  const commands = commandsForLocale(descriptionKey)
  return languageCode
    ? bot.api.setMyCommands(commands, { language_code: languageCode })
    : bot.api.setMyCommands(commands)
}

export default async function configureBotCommands() {
  try {
    await Promise.all(commandLocales.map(setCommands))
  } catch (error) {
    console.error('Could not configure bot command menu', error)
  }
}
