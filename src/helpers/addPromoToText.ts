// import { promoExceptions } from '@/models/PromoException'
import Context from '@/models/Context'
import isRuChat from '@/helpers/isRuChat'
// import promoTexts from '@/helpers/promoTexts'

export default function addPromoToText(ctx: Context, text: string) {
  // return promoExceptions.includes(+ctx.dbchat.id)
  //   ? text
  //   : `${text}\n${isRuChat(ctx.dbchat) ? promoTexts.ru() : promoTexts.en()}`
  return isRuChat(ctx.dbchat)
    ? '_Друзья, простите, но я больше не могу терпеть игнорирование со стороны команды Телеграма. Пожалуйста, напишите, насколько сильно вам нужен Войси в официальном чате Телеграма — @tdlibchat. 13 миллионов людей пользуется Войси каждый день, но надо мной — и другими сторонними разработчиками — Телеграм просто смеется.\n\nМы можем потерять Войси! Спросите у команды Телеграма в @tdlibchat, почему Войси не работает. Спасибо вам большое, что вы со мной! Всегда ваш, @borodutch_ ❤️'
    : "_Friends, I'm sorry, but I can no longer withstand the Telegram team's public disregard of Voicy existence. Please tell the Telegram team how helpful Voicy is to you in the official Telegram chat — @tdlibchat. 13 million people use Voicy daily, but Telegram laughs at other bot developers and me.\n\nWe can lose Voicy! Ask the Telegram team at @tdlibchat why doesn't Voicy work. Thank you a lot for your support! Always yours, @borodutch_ ❤️"
}
