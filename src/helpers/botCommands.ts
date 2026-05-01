export type BotCommandDefinition = {
  command: string
  description: string
  russianDescription: string
}

export const publicBotCommands: BotCommandDefinition[] = [
  {
    command: 'start',
    description: 'Start Voicy',
    russianDescription: 'Запустить Войси',
  },
  {
    command: 'help',
    description: 'Show help',
    russianDescription: 'Показать помощь',
  },
  {
    command: 'language',
    description: 'Change the interface language',
    russianDescription: 'Сменить язык интерфейса',
  },
  {
    command: 'donate',
    description: 'Support transcription compute',
    russianDescription: 'Поддержать оплату расшифровки',
  },
  {
    command: 'files',
    description: 'Toggle audio file transcription',
    russianDescription: 'Включить или выключить аудиофайлы',
  },
  {
    command: 'silent',
    description: 'Toggle status messages',
    russianDescription: 'Включить или выключить статусы',
  },
  {
    command: 'lock',
    description: 'Restrict commands to group admins',
    russianDescription: 'Ограничить команды админами',
  },
  {
    command: 'url',
    description: 'Open large-file transcription',
    russianDescription: 'Открыть расшифровку больших файлов',
  },
  {
    command: 'transcribe_all',
    description: 'Transcribe every voice message',
    russianDescription: 'Расшифровывать все голосовые',
  },
  {
    command: 'transcribe',
    description: 'Transcribe the replied-to message',
    russianDescription: 'Расшифровать сообщение в ответе',
  },
  {
    command: 'privacy',
    description: 'Open the privacy policy',
    russianDescription: 'Открыть политику приватности',
  },
]

export const hiddenBotCommands = ['id', 'l']

export const allBotCommands = [
  ...publicBotCommands.map((command) => command.command),
  ...hiddenBotCommands,
]
