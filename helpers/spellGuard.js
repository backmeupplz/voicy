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
        console.log("check spelling")

        let word = contains(text, linaWords)
        if (word != "") {
            sendReply(ctx, word)
            return
        }
        if (chat.smartGuard) {
            word = contains(text, linaRegexs, true)
            if (word != "") {
                sendReply(ctx, word)
                return
            }
        }
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

    if (isRegex) {
        for (let regex of linaRegexs)
        {   

            for (i = 0; i < bits.length; i++) {
                if (regex.test(bits[i]))
                    return str.split(/[\s,.-]+/)[i]
            }   
        }
    
    } else {
        for (let word of dictionary)
        {   
            for (i = 0; i < bits.length; i++) {
                if (bits[i] == word)
                    return str.split(/[\s,.-]+/)[i]
            }  
        }
    }

    return "";
}

// Exports
module.exports = checkSpelling