// The "What can this bot do?" text above the Start button (description) and
// the profile/share text (short description), set from code at startup so
// they can't drift from the bot again. Plain text: Telegram renders no markup.
export type BotDescriptionText = {
  // undefined is the default for every language without its own text
  languageCode?: string
  intro: string
  commands: string
  donation: string
  sourceLabel: string
  supportLabel: string
  shortDescription: string
}

export const sourceUrl = 'https://github.com/backmeupplz/voicy'
export const supportContact = '@borodutch_support'

// Telegram's limits for setMyDescription and setMyShortDescription
export const maxDescriptionLength = 512
export const maxShortDescriptionLength = 120

export const botDescriptionTexts: BotDescriptionText[] = [
  {
    languageCode: undefined,
    intro:
      '😎 Voicy turns voice messages and video notes into text with Whisper on its own GPUs, in private chats and in groups.',
    commands:
      'Send /files to turn audio and video files into text too, and /language to change the interface language.',
    donation: 'Each chat is activated once with a donation: /donate.',
    sourceLabel: 'Open source',
    supportLabel: 'Support',
    shortDescription:
      'Turns voice messages, video notes, audio and video files into text with Whisper, in private chats and groups.',
  },
  {
    languageCode: 'de',
    intro:
      '😎 Voicy wandelt Sprachnachrichten und Videonachrichten mit Whisper auf eigenen GPUs in Text um, in privaten Chats und in Gruppen.',
    commands:
      'Sende /files, damit auch Audio- und Videodateien in Text umgewandelt werden, und /language, um die Sprache der Oberfläche zu ändern.',
    donation: 'Jeder Chat wird einmalig mit einer Spende aktiviert: /donate.',
    sourceLabel: 'Open Source',
    supportLabel: 'Support',
    shortDescription:
      'Wandelt Sprach- und Videonachrichten, Audio- und Videodateien mit Whisper in Text um, privat und in Gruppen.',
  },
  {
    languageCode: 'es',
    intro:
      '😎 Voicy convierte mensajes de voz y notas de video en texto con Whisper en sus propias GPU, en chats privados y en grupos.',
    commands:
      'Envía /files para convertir también archivos de audio y video, y /language para cambiar el idioma de la interfaz.',
    donation: 'Cada chat se activa una sola vez con una donación: /donate.',
    sourceLabel: 'Código abierto',
    supportLabel: 'Soporte',
    shortDescription:
      'Convierte mensajes de voz, notas de video y archivos de audio y video en texto con Whisper, en chats y grupos.',
  },
  {
    languageCode: 'pt',
    intro:
      '😎 O Voicy transforma mensagens de voz e notas de vídeo em texto com o Whisper em GPUs próprias, em chats privados e em grupos.',
    commands:
      'Envie /files para transformar também arquivos de áudio e vídeo em texto, e /language para alterar o idioma da interface.',
    donation: 'Cada chat é ativado uma única vez com uma doação: /donate.',
    sourceLabel: 'Código aberto',
    supportLabel: 'Suporte',
    shortDescription:
      'Transforma mensagens de voz, notas de vídeo e arquivos de áudio e vídeo em texto com Whisper, em chats e grupos.',
  },
  {
    languageCode: 'ru',
    intro:
      '😎 Войси превращает голосовые сообщения и видеосообщения в текст с помощью Whisper на собственных видеокартах — в личных чатах и в группах.',
    commands:
      'Отправьте /files, чтобы Войси превращал в текст и аудио- и видеофайлы, и /language, чтобы сменить язык интерфейса.',
    donation: 'Каждый чат активируется один раз донатом: /donate.',
    sourceLabel: 'Открытый код',
    supportLabel: 'Поддержка',
    shortDescription:
      'Превращает голосовые и видеосообщения, аудио- и видеофайлы в текст с помощью Whisper — в личных чатах и группах.',
  },
  {
    languageCode: 'uk',
    intro:
      '😎 Voicy перетворює голосові повідомлення й відеоповідомлення на текст за допомогою Whisper на власних відеокартах — в особистих чатах і в групах.',
    commands:
      'Надішліть /files, щоб Voicy перетворював на текст також аудіо- й відеофайли, і /language, щоб змінити мову інтерфейсу.',
    donation: 'Кожен чат активується один раз донатом: /donate.',
    sourceLabel: 'Відкритий код',
    supportLabel: 'Підтримка',
    shortDescription:
      'Перетворює голосові й відеоповідомлення, аудіо- й відеофайли на текст з Whisper — в особистих чатах і групах.',
  },
]

// The donation sentence is only true while the donation wall is on
export function botDescription(
  text: BotDescriptionText,
  { donationWall }: { donationWall: boolean }
) {
  return [
    text.intro,
    text.commands,
    ...(donationWall ? [text.donation] : []),
    `${text.sourceLabel}: ${sourceUrl}\n${text.supportLabel}: ${supportContact}`,
  ].join('\n\n')
}
