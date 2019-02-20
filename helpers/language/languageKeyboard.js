// Dependencies
const { engineLanguages } = require('./languageConstants')

module.exports = function languageKeyboard(engine, page, isCommand) {
  const keyboard = []
  const list = engineLanguages(engine)

  let temp = []
  let i = 0
  const count = Object.keys(list).slice(page * 10, page * 10 + 10).length
  Object.keys(list)
    .slice(page * 10, page * 10 + 10)
    .forEach(name => {
      const code = list[name]
      const data =
        engine === 'wit'
          ? `li~${isCommand ? 1 : 0}~${engine}~${name}~${page}`
          : `li~${isCommand ? 1 : 0}~${engine}~${code}~???~${page}`
      if (engine === 'wit') {
        temp.push({
          text: name,
          callback_data: data,
        })

        if (i % 2 === 1 || i === count - 1) {
          keyboard.push(temp)
          temp = []
        }
        i += 1
      } else {
        keyboard.push([
          {
            text: name,
            callback_data: data,
          },
        ])
      }
    })

  const nav = []
  const data1 =
    engine === 'wit'
      ? `li~${isCommand ? 1 : 0}~${engine}~<~${page}`
      : `li~${isCommand ? 1 : 0}~${engine}~<~<~${page}`
  if (page > 0) {
    nav.push({
      text: '<',
      callback_data: data1,
    })
  }

  const data2 =
    engine === 'wit'
      ? `li~${isCommand ? 1 : 0}~${engine}~>~${page}`
      : `li~${isCommand ? 1 : 0}~${engine}~>~>~${page}`
  if (page < Object.keys(list).length / 10 - 1) {
    nav.push({
      text: '>',
      callback_data: data2,
    })
  }
  keyboard.unshift(nav)
  return keyboard
}
