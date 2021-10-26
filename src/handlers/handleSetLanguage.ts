import Context from '@/models/Context'
import Engine from '@/helpers/engine/Engine'
import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import engines from '@/engines'
import languageKeyboard from '@/helpers/language/languageKeyboard'
import localeCodeForChat from '@/helpers/localeCodeForChat'
import logAnswerTime from '@/helpers/logAnswerTime'
import report from '@/helpers/report'
import sendStart from '@/helpers/sendStart'

function languageString(languageCode: string, engine: Engine) {
  const engineObject = engines[engine]
  const language = engineObject.languages.find((l) => l.code === languageCode)
  return language.name
}

export default async function handleSetLanguage(ctx: Context) {
  // Get options
  const options = ctx.callbackQuery.data.split('~')
  const engine = options[2] as Engine
  const engineObject: EngineRecognizer = engines[engine]
  const isCommand = +options[1] === 1
  // Get language
  const language = options[3]
  // Check if pagination
  if (['<', '>'].includes(language)) {
    // Get text
    const text = isCommand
      ? ctx.i18n.t('language', { engine: engineObject.name })
      : ctx.i18n.t('language_without_engine')
    // Get page
    const page = +options[4]
    // Edit message
    try {
      await ctx.editMessageText(text, {
        reply_markup: languageKeyboard(
          engine,
          isCommand,
          language === '<' ? page - 1 : page + 1
        ),
        parse_mode: 'Markdown',
      })
    } catch (error) {
      report(error, { ctx, location: 'handleSetLanguage' })
    }
    return
  }
  // Set language
  ctx.dbchat.languages[engine] = language
  ctx.dbchat.markModified('languages')
  // Save chat
  await ctx.dbchat.save()
  // Update language
  ctx.i18n.locale(localeCodeForChat(ctx.dbchat))
  // Edit message
  await ctx.editMessageText(
    ctx.i18n.t('language_success', {
      language: languageString(language, engine),
      engine: engineObject.name,
    }),
    {
      parse_mode: 'Markdown',
    }
  )
  // Recomend Nanosemantics
  if (engine === 'wit' && languageString(language, engine) === 'Russian') {
    await ctx.reply(
      'Вы используете движок Wit.ai для распознавания русского языка. Советую вам попробовать Nanosemantics в /engine, он работает лучше с русским языком. Спасибо!'
    )
  }
  // If it was not a command, send start
  if (!isCommand) {
    await sendStart(ctx)
  }
  // Log time
  logAnswerTime(ctx, 'setting language')
}
