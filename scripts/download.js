const dotenv = require('dotenv')
dotenv.config({ path: `${__dirname}/../.env` })
const axios = require('axios')
const unflatten = require('flat').unflatten
const fs = require('fs')
const jsyaml = require('js-yaml')

;(async function getTranslations() {
  console.log('==== Getting localizations')
  const translations = (
    await axios.get('https://localizer.borodutch.com/localizations')
  ).data.filter((l) => {
    return l.tags.indexOf('voicybot') > -1
  })
  console.log('==== Got localizations:')
  console.log(JSON.stringify(translations, undefined, 2))
  // Get flattened map
  const flattenedMap = {} // { key: {en: '', ru: ''}}
  translations.forEach((t) => {
    const key = t.key
    const variants = t.variants.filter((v) => !!v.selected)
    flattenedMap[key] = variants.reduce((p, c) => {
      p[c.language] = c.text
      return p
    }, {})
  })
  console.log('==== Decoded response:')
  console.log(flattenedMap)
  // Reverse the map
  const reversedMap = {}
  Object.keys(flattenedMap).forEach((k) => {
    const internals = flattenedMap[k]
    for (const language in internals) {
      const text = internals[language]
      if (!reversedMap[language]) {
        reversedMap[language] = {}
      }
      reversedMap[language][k] = text
    }
  })
  const unflattened = unflatten(reversedMap)
  console.log('==== Reversed and unflattened map')
  console.log(unflattened)
  for (const language in unflattened) {
    const obj = unflattened[language]
    const yaml = jsyaml.safeDump(obj, {
      lineWidth: -1,
      noCompatMode: true,
    })
    fs.writeFileSync(`${__dirname}/../locales/${language}.yaml`, yaml)
  }
  console.log('==== Saved object to the file')
})()
