import { chatKind } from '@/helpers/promo'
import { markChatReachable } from '@/helpers/chatReachability'
import { markdownI18n } from '@/helpers/telegramMarkdown'
import { promoHook } from '@/helpers/promoHost'
import Context from '@/models/Context'

async function isGroupAdmin(ctx: Context) {
  // an anonymous admin, or the group posting as itself
  if (
    ctx.from?.username === 'GroupAnonymousBot' ||
    ctx.senderChat?.id === ctx.chat?.id
  )
    return true
  if (!ctx.from) return false
  try {
    const member = await ctx.getChatMember(ctx.from.id)
    return ['creator', 'administrator'].includes(member.status)
  } catch {
    // e.g. someone posting as a channel: not an admin of this group
    return false
  }
}

// /promos [on|off]: group admins turn Prime Radiant's group promos (a button
// for another bot by the same maker under a matching transcription) on or off
export default async function handlePromos(ctx: Context) {
  const reply = (key: string) =>
    ctx.reply(markdownI18n(ctx, key), { parse_mode: 'Markdown' })
  if (!ctx.chat || chatKind(ctx.chat.type) !== 'group') {
    return reply('error_group')
  }
  const arg = String(ctx.match || '')
    .trim()
    .toLowerCase()
  if (arg !== 'on' && arg !== 'off') {
    const on = await promoHook.groupOn(ctx.chat.id)
    await reply(
      on === undefined
        ? 'promos_error'
        : on
        ? 'promos_status_on'
        : 'promos_status_off'
    )
  } else if (!(await isGroupAdmin(ctx))) {
    await reply('promos_admins_only')
  } else if (await promoHook.setGroup(ctx.chat.id, arg === 'on')) {
    await reply(arg === 'on' ? 'promos_on' : 'promos_off')
  } else {
    await reply('promos_error')
  }
  await markChatReachable(ctx, '/promos')
}
