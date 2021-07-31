// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupDictionary(bot) {
  bot.command('dictionary', async ctx => {
    let allWords = ctx.dbchat.dictionary

    await ctx.replyWithMarkdown(
      ctx.i18n.t('dictionary_true', { dictionary: allWords.join(' ') })
    )
  })

  bot.command('cleandict', checkAdminLock, async ctx => {

    ctx.dbchat.dictionary = []
    ctx.dbchat = await ctx.dbchat.save()

    await ctx.replyWithMarkdown(
      ctx.i18n.t('dictionary_cleaned')
    )


    logAnswerTime(ctx, '/cleandict')
  })

  bot.command('rmwords', checkAdminLock, async ctx => {
    function removeItemAll(arr, value) {
      var i = 0;
      while (i < arr.length) {
        if (arr[i] === value) {
          arr.splice(i, 1);
        } else {
          ++i;
        }
      }
      return arr;
    }

    const message = ctx.message || ctx.update.channel_post
    let words = message.text.split(' ')
    words.shift()
    if (words.length > 0) {
      let dictionary = []
      let deletedWords = []
      ctx.dbchat.dictionary.map(elem => dictionary.push(elem))

      for (let word of words) {
        let length = dictionary.length
        dictionary = removeItemAll(dictionary, word)
        if (length > dictionary.length)
          deletedWords.push(word)
      }
      ctx.dbchat.dictionary = dictionary
      ctx.dbchat = await ctx.dbchat.save()

      let allWords = ctx.dbchat.dictionary

      if (deletedWords.length > 0)
        await ctx.replyWithMarkdown(
          ctx.i18n.t('rmword_true', { words: deletedWords.join(', '), dictionary: allWords.join(' ') }))
      else
        await ctx.replyWithMarkdown(
          ctx.i18n.t('rmword_false', { dictionary: allWords.join(' ') }))
    }
    else {
      await ctx.replyWithMarkdown(
        ctx.i18n.t('rmword_false', { dictionary: ctx.dbchat.dictionary.join(' ') }))
    }



    logAnswerTime(ctx, '/rmwords')
  })

  bot.command('addwords', checkAdminLock, async ctx => {

    console.log(ctx)

    const message = ctx.message || ctx.update.channel_post
    let words = message.text.split(' ')
    words.shift()
    if (words.length > 0) {
      let dictionary = []
      let addedWords = []
      ctx.dbchat.dictionary.map(elem => dictionary.push(elem))

      for (let word of words) {
        if (!dictionary.includes(word)) {
          ctx.dbchat.dictionary.push(word)
          addedWords.push(word)
        }
      }

      ctx.dbchat = await ctx.dbchat.save()
      let allWords = ctx.dbchat.dictionary


      if (addedWords.length > 0)
        await ctx.replyWithMarkdown(
          ctx.i18n.t('addword_true', { words: addedWords.join(', '), dictionary: allWords.join(' ') }))
      else
        await ctx.replyWithMarkdown(
          ctx.i18n.t('addword_false', { dictionary: allWords.join(' ') }))
    } else {
      await ctx.replyWithMarkdown(
        ctx.i18n.t('addword_false', { dictionary: ctx.dbchat.dictionary.join(' ') }))
    }


    logAnswerTime(ctx, '/addwords')
  })
}



// Exports
module.exports = setupDictionary