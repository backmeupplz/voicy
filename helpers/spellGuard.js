const { report } = require('./report')
const { linaWords, linaRegexs } = require('./dictionary')
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
            let { words, editedStr } = contains(text, linaRegexs, true, true)
            if (words.length != 0) {
                reply += words.join(' ')

                await sendMessage(ctx, editedStr)
            }
        } else {
            let { words, editedStr } = contains(text, linaWords, false, true)
            if (words.length != 0) {
                reply += words.join(' ')

                await sendMessage(ctx, editedStr)
            }
        }
        if (reply.lenth > 0)
            reply = reply.slice(0, -3)

        let { words } = contains(text, dictionary)
        if (words.length != 0) {
            reply += ' '
            reply += words.join(' ')
        }

        if (reply.length > 0) {
            console.log("Reply:", reply)
            sendReply(ctx, reply)

            // editMessage(ctx, reply)
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

/**
 * Sends reply to a message with violating content
 * @param {Telegraf:Context} ctx Context of the request
 */
async function sendMessage(ctx, message) {
    await ctx.telegram.sendMessage(ctx.message.chat.id, message)
}

/**
 * Sends reply to a message with violating content
 * @param {Telegraf:Context} ctx Context of the request
 */
async function editMessage(ctx, word) {
    const message = ctx.message || ctx.update.channel_post
    const options = {}
    options.parse_mode = 'Markdown'
    options.disable_web_page_preview = true
    try {
        await ctx.telegram.editMessageText(
            message.chat.id,
            message.message_id,
            null,
            "Я мразота конченая пишу плохие слова",
            options
        )

    } catch (err) {
        report(ctx, err, 'handleMessage')
    }
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

function contains(str, dictionary, isRegex = false, isEdit = false) {
    let bits = str.toLowerCase().split(/[\s,.-]+/)
    let bitsRegularCase = str.split(/[\s,.-]+/)
    let decomposedStr = str.split(/[\s,.-]+/)
    let foundWords = []
    let editedStr = str

    if (isRegex) {
        for (let regex of dictionary) {
            for (i = 0; i < bits.length; i++) {
                if (regex.test(bits[i])) {
                    if (isEdit) {
                        let fixedWord = bitsRegularCase[i].replace(/^[е|Е|e|E]/g, '')
                            .replace(/(?<!^)е(?!$)/g, 'и')
                            .replace(/(?<!^)Е(?!$)/g, 'И')
                        let regex = new RegExp(bitsRegularCase[i], "g")
                        console.log(editedStr, ' replace ' + bitsRegularCase[i] + ' with ' + fixedWord)
                        editedStr = editedStr.replace(regex, "*" + fixedWord)
                    }
                    foundWords.push(str.split(/[\s,.-]+/)[i])
                }

            }
        }

    } else {
        for (let word of dictionary) {
            for (i = 0; i < bits.length; i++) {
                if (bits[i] == word) {
                    if (isEdit) {
                        let fixedWord = bitsRegularCase[i].replace(/^[е|Е|e|E]/g, '')
                            .replace(/(?<!^)е(?!$)/g, 'и')
                            .replace(/(?<!^)Е(?!$)/g, 'И')
                        let regex = new RegExp(bitsRegularCase[i], "g")
                        editedStr.replace(regex, "*" + fixedWord)
                    }
                    foundWords.push(str.split(/[\s,.-]+/)[i])
                }

            }
        }
    }
    return { words: foundWords, editedStr: editedStr };
}

// Exports
module.exports = checkSpelling