import { InlineKeyboard } from 'grammy'
import engines from '@/engines'
import Engine from '@/helpers/engine/Engine'
import EngineRecognizer from '@/helpers/engine/EngineRecognizer'
import Language from '@/helpers/engine/Language'

const pageSize = 10

function buttonFromItem(item: Language, isCommand: boolean, engine: Engine) {
  return {
    text: item.name,
    callback_data: `li~${isCommand ? 1 : 0}~${engine}~${item.code}`,
  }
}

function pageFromList(
  list: Language[],
  page: number,
  isCommand: boolean,
  engine: Engine
) {
  const items = list.slice(page * pageSize, page * pageSize + pageSize)
  return items.reduce((p, c, i) => {
    p.add(buttonFromItem(c, isCommand, engine))
    if (i % 2 !== 0) {
      p.row()
    }
    return p
  }, new InlineKeyboard())
}

export default function languageKeyboard(
  engine: Engine,
  isCommand: boolean,
  page = 0
) {
  const engineObject: EngineRecognizer = engines[engine]
  const list = engineObject.languages
  list.sort((a, b) => (a.name < b.name ? -1 : 1))
  const keyboard = pageFromList(list, page, isCommand, engine)
  if (list.length > pageSize) {
    const nav = []
    if (page > 0) {
      keyboard.add({
        text: '⬅️',
        callback_data: `li~${isCommand ? 1 : 0}~${engine}~<~${page}`,
      })
    }
    if (page < Object.keys(list).length / 10 - 1) {
      keyboard.add({
        text: '➡️',
        callback_data: `li~${isCommand ? 1 : 0}~${engine}~>~${page}`,
      })
    }
  }
  return keyboard
}
