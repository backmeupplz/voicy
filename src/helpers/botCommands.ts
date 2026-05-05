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
    command: 'id',
    description: 'Show chat and user IDs',
    russianDescription: 'Показать ID чата и пользователя',
  },
  {
    command: 'language',
    description: 'Change the interface language',
    russianDescription: 'Сменить язык интерфейса',
  },
  {
    command: 'donate',
    description: 'Help turn voice into text',
    russianDescription: 'Помочь превращать голос в текст',
  },
  {
    command: 'files',
    description: 'Toggle audio files',
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
    command: 'transcribe_all',
    description: 'Turn every voice into text',
    russianDescription: 'Превращать все голосовые в текст',
  },
  {
    command: 'transcribe',
    description: 'Turn the replied-to message into text',
    russianDescription: 'Превратить сообщение в ответе в текст',
  },
  {
    command: 'privacy',
    description: 'Open the privacy policy',
    russianDescription: 'Открыть политику приватности',
  },
]

export const allBotCommands = publicBotCommands.map(
  (command) => command.command
)
