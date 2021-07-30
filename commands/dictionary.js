// Dependencies
const logAnswerTime = require('../helpers/logAnswerTime')
const checkAdminLock = require('../middlewares/adminLock')

function setupDictionary(bot) {
  bot.command('dictionary', checkAdminLock, async ctx => {
    console.log(ctx)

    const message = ctx.message || ctx.update.channel_post
    let words = message.text.split(' ')
    words.shift()
    if (words.length > 0) {
        for(let word of words)
            ctx.dbchat.dictionary.push(word)  
        ctx.dbchat = await ctx.dbchat.save()
        let allWords = ctx.dbchat.dictionary
        await ctx.replyWithMarkdown(
            ctx.i18n.t('dictionary_true', { words: message.text.slice(message.text.indexOf(' '), message.length), dictionary: allWords.join(' ')})
          )
    } else {
        await ctx.replyWithMarkdown(
            ctx.i18n.t('dictionary_false')
          )
    }

    logAnswerTime(ctx, '/dictionary')
  })

  bot.command('cleandict', checkAdminLock, async ctx => {

    ctx.dbchat.dictionary = []
    ctx.dbchat = await ctx.dbchat.save()

    await ctx.replyWithMarkdown(
    ctx.i18n.t('dictionary_cleaned')
    )


    logAnswerTime(ctx, '/cleandict')
  })
}



// Exports
module.exports = setupDictionary