export type BotCommandDefinition = {
  command: string
  description: string
  germanDescription: string
  portugueseDescription: string
  russianDescription: string
  spanishDescription: string
  ukrainianDescription: string
}

export const publicBotCommands: BotCommandDefinition[] = [
  {
    command: 'start',
    description: 'Start Voicy',
    germanDescription: 'Voicy starten',
    portugueseDescription: 'Iniciar o Voicy',
    russianDescription: 'Запустить Войси',
    spanishDescription: 'Iniciar Voicy',
    ukrainianDescription: 'Запустити Voicy',
  },
  {
    command: 'help',
    description: 'Show help',
    germanDescription: 'Hilfe anzeigen',
    portugueseDescription: 'Mostrar ajuda',
    russianDescription: 'Показать помощь',
    spanishDescription: 'Mostrar ayuda',
    ukrainianDescription: 'Показати довідку',
  },
  {
    command: 'id',
    description: 'Show chat and user IDs',
    germanDescription: 'Chat- und Nutzer-IDs zeigen',
    portugueseDescription: 'Mostrar IDs do chat e do usuário',
    russianDescription: 'Показать ID чата и пользователя',
    spanishDescription: 'Mostrar IDs del chat y del usuario',
    ukrainianDescription: 'Показати ID чату й користувача',
  },
  {
    command: 'language',
    description: 'Change the interface language',
    germanDescription: 'Sprache der Oberfläche ändern',
    portugueseDescription: 'Alterar idioma da interface',
    russianDescription: 'Сменить язык интерфейса',
    spanishDescription: 'Cambiar idioma de la interfaz',
    ukrainianDescription: 'Змінити мову інтерфейсу',
  },
  {
    command: 'donate',
    description: 'Help turn voice into text',
    germanDescription: 'Spracherkennung unterstützen',
    portugueseDescription: 'Ajudar a transcrever voz',
    russianDescription: 'Помочь превращать голос в текст',
    spanishDescription: 'Ayudar a transcribir voz',
    ukrainianDescription: 'Допомогти перетворювати голос на текст',
  },
  {
    command: 'files',
    description: 'Toggle audio files',
    germanDescription: 'Audiodateien umschalten',
    portugueseDescription: 'Ativar ou desativar arquivos de áudio',
    russianDescription: 'Включить или выключить аудиофайлы',
    spanishDescription: 'Activar o desactivar archivos de audio',
    ukrainianDescription: 'Увімкнути або вимкнути аудіофайли',
  },
  {
    command: 'silent',
    description: 'Toggle status messages',
    germanDescription: 'Statusmeldungen umschalten',
    portugueseDescription: 'Ativar ou desativar status',
    russianDescription: 'Включить или выключить статусы',
    spanishDescription: 'Activar o desactivar estados',
    ukrainianDescription: 'Увімкнути або вимкнути статуси',
  },
  {
    command: 'lock',
    description: 'Restrict commands to group admins',
    germanDescription: 'Befehle auf Gruppenadmins beschränken',
    portugueseDescription: 'Restringir comandos a admins do grupo',
    russianDescription: 'Ограничить команды админами',
    spanishDescription: 'Restringir comandos a admins del grupo',
    ukrainianDescription: 'Обмежити команди адміністраторами',
  },
  {
    command: 'transcribe_all',
    description: 'Turn every voice into text',
    germanDescription: 'Alle Sprachnachrichten transkribieren',
    portugueseDescription: 'Transcrever todos os áudios',
    russianDescription: 'Превращать все голосовые в текст',
    spanishDescription: 'Transcribir todos los audios',
    ukrainianDescription: 'Перетворювати всі голосові на текст',
  },
  {
    command: 'transcribe',
    description: 'Turn the replied-to message into text',
    germanDescription: 'Beantwortete Nachricht transkribieren',
    portugueseDescription: 'Transcrever a mensagem respondida',
    russianDescription: 'Превратить сообщение в ответе в текст',
    spanishDescription: 'Transcribir el mensaje respondido',
    ukrainianDescription: 'Перетворити повідомлення у відповіді на текст',
  },
  {
    command: 'privacy',
    description: 'Open the privacy policy',
    germanDescription: 'Datenschutzerklärung öffnen',
    portugueseDescription: 'Abrir a política de privacidade',
    russianDescription: 'Открыть политику приватности',
    spanishDescription: 'Abrir la política de privacidad',
    ukrainianDescription: 'Відкрити політику приватності',
  },
]

export const allBotCommands = publicBotCommands.map(
  (command) => command.command
)
