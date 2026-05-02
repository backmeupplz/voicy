import { findUiLanguage } from '@/helpers/language/uiLanguages'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import Context from '@/models/Context'
import languageKeyboard from '@/helpers/language/languageKeyboard'
import logAnswerTime from '@/helpers/logAnswerTime'
import report from '@/helpers/report'
import sendStart from '@/helpers/sendStart'

export default async function handleSetLanguage(ctx: Context) {
  const options = ctx.callbackQuery.data.split('~')
  const isCommand = +options[1] === 1
  const language = options[2]

  try {
    await ctx.answerCallbackQuery()
  } catch (error) {
    report(error, { ctx, location: 'handleSetLanguage.answerCallbackQuery' })
  }

  if (['<', '>'].includes(language)) {
    const page = +options[3]
    try {
      await ctx.editMessageText(markdownI18n(ctx, 'language'), {
        reply_markup: languageKeyboard(
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

  const languageObject = findUiLanguage(language)
  if (!languageObject) {
    return
  }

  ctx.dbchat.uiLanguage = languageObject.code
  ctx.dbchat.uiLanguageSelectedManually = true
  await ctx.dbchat.save()
  ctx.i18n.locale(languageObject.code)

  await ctx.editMessageText(
    markdownI18n(ctx, 'language_success', {
      language: languageObject.name,
    }),
    {
      parse_mode: 'Markdown',
    }
  )

  if (!isCommand) {
    await sendStart(ctx)
  }

  logAnswerTime(ctx, 'setting language')
}
