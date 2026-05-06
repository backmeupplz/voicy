import { Bot } from 'grammy'
import Context from '@/models/Context'
import configureTelegramApiRetry from '@/helpers/configureTelegramApiRetry'

const bot = new Bot<Context>(process.env.TOKEN)
configureTelegramApiRetry(bot.api.config)

export default bot
