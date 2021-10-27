import { Bot } from 'grammy'
import Context from '@/models/Context'

const bot = new Bot<Context>(process.env.TOKEN)

export default bot
