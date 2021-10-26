import Context from '@/models/Context'
import Engine from '@/helpers/engine/Engine'
import engines from '@/engines'
import localeCodeForChat from '@/helpers/localeCodeForChat'

export default function setLanguageCodeFromTelegram(ctx: Context) {
  const code = ctx.from.language_code.split('-')[0]
  for (const engine of Object.values(engines)) {
    ctx.dbchat.languages[engine.name] = engine.languageForTelegramCode(code)
  }
  ctx.dbchat.markModified('languages')
  if (code.toLowerCase().indexOf('ru') > -1) {
    ctx.dbchat.engine = Engine.ashmanov
  }
  ctx.i18n.locale(localeCodeForChat(ctx.dbchat))
  return ctx.dbchat.save()
}
