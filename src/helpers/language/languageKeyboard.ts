import { InlineKeyboard } from 'grammy'
import { UiLanguage, uiLanguages } from '@/helpers/language/uiLanguages'

const pageSize = 10

function buttonFromItem(item: UiLanguage, isCommand: boolean) {
  return {
    text: item.name,
    callback_data: `li~${isCommand ? 1 : 0}~${item.code}`,
  }
}

function pageFromList(list: UiLanguage[], page: number, isCommand: boolean) {
  const items = list.slice(page * pageSize, page * pageSize + pageSize)
  return items.reduce((p, c, i) => {
    p.add(buttonFromItem(c, isCommand))
    if (i % 2 !== 0) {
      p.row()
    }
    return p
  }, new InlineKeyboard())
}

export default function languageKeyboard(isCommand: boolean, page = 0) {
  const list = uiLanguages.sort((a, b) => (a.name < b.name ? -1 : 1))
  const keyboard = pageFromList(list, page, isCommand)
  if (list.length > pageSize) {
    if (page > 0) {
      keyboard.row()
      keyboard.add({
        text: '⬅️',
        callback_data: `li~${isCommand ? 1 : 0}~<~${page}`,
      })
    }
    if (page < Object.keys(list).length / 10 - 1) {
      if (page <= 0) {
        keyboard.row()
      }
      keyboard.add({
        text: '➡️',
        callback_data: `li~${isCommand ? 1 : 0}~>~${page}`,
      })
    }
  }
  return keyboard
}
