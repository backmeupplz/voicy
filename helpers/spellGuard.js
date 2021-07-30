const { report } = require('./report')
const {linaWords, linaRegexs} = require('./dictionary')
const { findChat } = require('./db')

/**
 * Checks messages for words in a dictionary and sends reply if finds it
 * @param {Telegraf:Context} ctx Context of the request
 */
async function checkSpelling(ctx, text) {
    try {
        const chat = await findChat(ctx.chat.id)
        let dictionary = []
        chat.dictionary.map(elem => dictionary.push(elem))  

        console.log(dictionary)
        let reply = ""
        
        if (chat.smartGuard) {
            let words = contains(text, linaRegexs, true)
            if(words.length != 0) {
                for(let word of words)
                    reply += word + '(' + word.replace(/е/g, 'и').replace(/Е/g, 'И').replace(/e/g, 'i').replace(/E/g, 'I') + '), ' 
            }
        } else {
            let words = contains(text, linaWords)
            if (words.length != 0) {
                for(let word of words)
                    reply += word + '(' + word.replace(/е/g, 'и').replace(/Е/g, 'И').replace(/e/g, 'i').replace(/E/g, 'I') + '), '  
            }
        }
        if (reply.lenth > 0)
            reply = reply.slice(0, -2)

        let words = contains(text, dictionary)
        if (words.length != 0) {
            reply += words.join(', ')
        }
        console.log(reply)
        if (reply.length > 0)
            sendReply(ctx, reply)
    } catch (err) {
        report(ctx, err, 'handleMessage')
    }
}

/**
 * Sends reply to a message with violating content
 * @param {Telegraf:Context} ctx Context of the request
 */
async function sendReply(ctx, word) {

    const message = ctx.message || ctx.update.channel_post

    const options = {
        reply_to_message_id: message.message_id,
    }
    options.parse_mode = 'Markdown'
    options.disable_web_page_preview = true    

    let i = getRandomInt(4)
    let langKey = 'judgemental_' + i

    await ctx.replyWithMarkdown(ctx.i18n.t(langKey, { word: word }), options)
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

function contains(str, dictionary, isRegex = false)
{
    bits = str.toLowerCase().split(/[\s,.-]+/)
    foundWords = []

    if (isRegex) {
        for (let regex of dictionary)
        {   
            for (i = 0; i < bits.length; i++) {
                if (regex.test(bits[i]))
                    foundWords.push(str.split(/[\s,.-]+/)[i])
            }   
        }
    
    } else {
        for (let word of dictionary)
        {   
            for (i = 0; i < bits.length; i++) {
                if (bits[i] == word)
                    foundWords.push(str.split(/[\s,.-]+/)[i])
            }  
        }
    }

    return foundWords;
}

// Exports
module.exports = checkSpelling