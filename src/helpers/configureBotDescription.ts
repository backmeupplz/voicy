import { botDescription, botDescriptionTexts } from '@/helpers/botDescriptions'
import { isDonationWallEnabled } from '@/helpers/donationWall'

// grammY 1.7 has no typed get/setMy(Short)Description, so this goes through api.raw
export type TelegramCall = (
  method: string,
  payload: Record<string, string>
) => Promise<unknown>

const fields = [
  {
    get: 'getMyDescription',
    set: 'setMyDescription',
    field: 'description',
  },
  {
    get: 'getMyShortDescription',
    set: 'setMyShortDescription',
    field: 'short_description',
  },
] as const

// Sets each text only when Telegram has a different one, so restarts don't
// spend the (tight) rate limit of the set methods. Returns the methods called
// with what they set; failures are logged and the other texts still sync.
export default async function configureBotDescription(
  call: TelegramCall,
  env: Record<string, string | undefined> = process.env
) {
  const donationWall = isDonationWallEnabled(env)
  const updated: string[] = []
  for (const text of botDescriptionTexts) {
    const language = text.languageCode
      ? { language_code: text.languageCode }
      : {}
    const wanted = {
      description: botDescription(text, { donationWall }),
      short_description: text.shortDescription,
    }
    for (const { get, set, field } of fields) {
      try {
        const current = (await call(get, language)) as Record<string, unknown>
        if (current?.[field] === wanted[field]) {
          continue
        }
        await call(set, { ...language, [field]: wanted[field] })
        updated.push(`${set}(${text.languageCode || 'default'})`)
      } catch (error) {
        console.error(
          `Could not configure bot ${field} (${
            text.languageCode || 'default'
          })`,
          error
        )
      }
    }
  }
  if (updated.length) {
    console.log(`Bot description updated: ${updated.join(', ')}`)
  }
  return updated
}
