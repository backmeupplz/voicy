const engines = require('../../engines')

const pageSize = 10

function buttonFromItem(item, isCommand, engine) {
  return {
    text: item.name,
    callback_data: `li~${isCommand ? 1 : 0}~${engine}~${item.code}`,
  }
}

function pageFromList(list, page, isCommand, engine) {
  const items = list.slice(page * pageSize, page * pageSize + pageSize)
  return items.reduce((p, c, i) => {
    if (i % 2 === 0) {
      p.push([buttonFromItem(c, isCommand, engine)])
    } else {
      p[p.length - 1].push(buttonFromItem(c, isCommand, engine))
    }
    return p
  }, [])
}

module.exports = function languageKeyboard(engine, page, isCommand) {
  // Get languages
  const engineObject = engines.find((e) => e.code === engine)
  const list = engineObject.languages
  list.sort((a, b) => (a.name < b.name ? -1 : 1))
  // Get items
  const items = pageFromList(list, page, isCommand, engine)
  // Add pagination if needed
  if (list.length > pageSize) {
    const nav = []
    if (page > 0) {
      nav.push({
        text: '⬅️',
        callback_data: `li~${isCommand ? 1 : 0}~${engine}~<~${page}`,
      })
    }
    if (page < Object.keys(list).length / 10 - 1) {
      nav.push({
        text: '➡️',
        callback_data: `li~${isCommand ? 1 : 0}~${engine}~>~${page}`,
      })
    }
    items.unshift(nav)
    items.push(nav)
  }
  // Return
  return items
}
