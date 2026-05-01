import { publicBotCommands } from '@/helpers/botCommands'
import bot from '@/helpers/bot'

const englishCommands = publicBotCommands.map(({ command, description }) => ({
  command,
  description,
}))

const russianCommands = publicBotCommands.map(
  ({ command, russianDescription }) => ({
    command,
    description: russianDescription,
  })
)

export default async function configureBotCommands() {
  try {
    await Promise.all([
      bot.api.setMyCommands(englishCommands),
      bot.api.setMyCommands(russianCommands, { language_code: 'ru' }),
    ])
  } catch (error) {
    console.error('Could not configure bot command menu', error)
  }
}
