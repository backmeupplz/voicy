const dotenv = require('dotenv')
dotenv.config({ path: `${__dirname}/../.env` })
const axios = require('axios')
const flatten = require('flat')
const fs = require('fs')
const jsyaml = require('js-yaml')

const files = fs.readdirSync(`${__dirname}/../locales`)

const localizations = {}

for (const fileName of files) {
  localizations[fileName.split('.')[0]] = jsyaml.safeLoad(
    fs.readFileSync(`${__dirname}/../locales/${fileName}`, 'utf8')
  )
}

const flattenedLocalizations = {}
Object.keys(localizations).forEach((language) => {
  flattenedLocalizations[language] = flatten(localizations[language])
})

const result = {}

const firstLanguage = Object.keys(flattenedLocalizations)[0]
Object.keys(flattenedLocalizations[firstLanguage]).forEach((key) => {
  const keyObject = {}
  for (const language in flattenedLocalizations) {
    if (flattenedLocalizations[language][key]) {
      keyObject[language] = flattenedLocalizations[language][key]
    }
  }
  result[key] = keyObject
})
;(async function postLocalizations() {
  console.log('==== Posting body:')
  console.log(JSON.stringify(result, undefined, 2))
  try {
    await axios.post(`https://localizer.borodutch.com/localizations`, {
      // await axios.post(`http://localhost:1337/localizations`, {
      localizations: result,
      password: process.env.PASSWORD,
      username: 'borodutch',
      tags: ['voicybot'],
    })
    console.error(`==== Body posted!`)
  } catch (err) {
    console.error(`==== Error posting: ${err.message}`)
  }
})()
