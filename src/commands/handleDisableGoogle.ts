import Context from '@/models/Context'

export default async function handleDisableGoogle(ctx: Context) {
  ctx.dbchat.googleKey = undefined
  await ctx.dbchat.save()
  await ctx.reply(ctx.i18n.t('google_disable_success'), {
    parse_mode: 'Markdown',
  })
}
