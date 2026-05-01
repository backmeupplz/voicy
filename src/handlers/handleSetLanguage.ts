import { findUiLanguage } from '@/helpers/language/uiLanguages'
import Context from '@/models/Context'
import languageKeyboard from '@/helpers/language/languageKeyboard'
import logAnswerTime from '@/helpers/logAnswerTime'
import report from '@/helpers/report'
import sendStart from '@/helpers/sendStart'

export default async function handleSetLanguage(ctx: Context) {
  const options = ctx.callbackQuery.data.split('~')
  const isCommand = +options[1] === 1
  const language = options[2]

  if (['<', '>'].includes(language)) {
    const page = +options[3]
    try {
      await ctx.editMessageText(ctx.i18n.t('language'), {
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
  await ctx.dbchat.save()
  ctx.i18n.locale(languageObject.code)

  await ctx.editMessageText(
    ctx.i18n.t('language_success', {
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
