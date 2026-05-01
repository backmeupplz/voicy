import bot from '@/helpers/bot'

type BotCommand = {
  command: string
  description: string
}

const englishCommands: BotCommand[] = [
  { command: 'start', description: 'Start Voicy' },
  { command: 'help', description: 'Show help' },
  { command: 'language', description: 'Change the interface language' },
  { command: 'donate', description: 'Support transcription compute' },
  { command: 'files', description: 'Toggle audio file transcription' },
  { command: 'silent', description: 'Toggle status messages' },
  { command: 'lock', description: 'Restrict commands to group admins' },
  { command: 'transcribe_all', description: 'Transcribe every voice message' },
  { command: 'transcribe', description: 'Transcribe the replied-to message' },
  { command: 'privacy', description: 'Open the privacy policy' },
]

const russianCommands: BotCommand[] = [
  { command: 'start', description: 'Запустить Войси' },
  { command: 'help', description: 'Показать помощь' },
  { command: 'language', description: 'Сменить язык интерфейса' },
  { command: 'donate', description: 'Поддержать оплату расшифровки' },
  { command: 'files', description: 'Включить или выключить аудиофайлы' },
  { command: 'silent', description: 'Включить или выключить статусы' },
  { command: 'lock', description: 'Ограничить команды админами' },
  { command: 'transcribe_all', description: 'Расшифровывать все голосовые' },
  { command: 'transcribe', description: 'Расшифровать сообщение в ответе' },
  { command: 'privacy', description: 'Открыть политику приватности' },
]

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
