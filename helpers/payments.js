/**
 * Used to send payments message
 *
 * @module payments
 * @license MIT
 */

const db = require('./db');
const config = require('../config');

function sendPaymentRequest(bot, chat, payee) {
  const p = db.findOptionalChat(payee)
    .then((payeeChat) => {
      if (!payeeChat) {
        p.cancel();
        return null;
      }
      return payeeChat;
    })
    .then((payeeChat) => {
      let price = 0.9;
      if (payeeChat.productHuntDiscountApplied && payeeChat.productHuntSecondsBought < 100000) {
        price = 0.45;
      }
      const options = {
        reply_markup: { inline_keyboard: [
          [{ text: `3000 ($${price * 3})`, callback_data: `pi~3000~${price * 100}~${payeeChat.id}` }],
          [{ text: `5000 ($${price * 5})`, callback_data: `pi~5000~${price * 100}~${payeeChat.id}` },
          { text: `10 000 ($${price * 10})`, callback_data: `pi~10000~${price * 100}~${payeeChat.id}` }],
          [{ text: `50 000 ($${price * 50})`, callback_data: `pi~50000~${price * 100}~${payeeChat.id}` },
          { text: `100 000 ($${price * 100})`, callback_data: `pi~100000~${price * 100}~${payeeChat.id}` }],
        ] },
        parse_mode: 'Markdown',
      };
      const text = 'Sorry, buying Google Speech is unavailable due to the payment system issues. We appologize for the inconvenience.';
      options.reply_markup = JSON.stringify(options.reply_markup);
      bot.sendMessage(chat.id, text, options);
    })
    .catch(/** Todo: handle error */);
}

function sendInvoice(bot, msg) {
  const options = msg.data.split('~');
  const amount = options[1];
  const price = options[2];
  const payee = options[3];

  bot.answerCallbackQuery(msg.id);

  bot.sendInvoice(msg.from.id, {
    title: `${amount} seconds for Google Speech`,
    description: `Buying seconds of Google Speech voice recognition at Voicy for chat id ${payee}`,
    payload: `${payee}~${msg.from.id}~${amount}`,
    provider_token: config.telegram_payments_token,
    start_parameter: `${payee}-${price}-${amount}`,
    currency: 'USD',
    prices: JSON.stringify([{
      label: 'Google Speech seconds',
      amount: (amount / 1000) * price,
    }]),
  });
}

function handlePreChekoutQuery(bot, msg) {
  bot.answerPreCheckoutQuery(msg.id, {
    ok: true,
  });
}

function handleSuccess(bot, msg) {
  const payment = msg.successful_payment;
  const payload = payment.invoice_payload.split('~');
  const payee = payload[0];

  const amount = parseInt(payload[2], 10);
  if (!amount) {
    return;
  }
  const p = db.findOptionalChat(payee)
    .then((payeeChat) => {
      if (!payeeChat) {
        p.cancel();
        return null;
      }
      return payeeChat;
    })
    .then((payeeChat) => {
      if (payeeChat.productHuntDiscountApplied && payeeChat.productHuntSecondsBought < 100000) {
        payeeChat.productHuntSecondsBought += amount;
      }
      payeeChat.seconds += amount;
      payeeChat.save();

      bot.sendMessage('76104711', `💰 ${msg.from.id} just purchased *${amount} seconds* for ${payeeChat.id}. Total is *${payeeChat.seconds} seconds* now.`, {
        parse_mode: 'Markdown',
      });
    })
    .catch(/** Todo: handle error */);
}

/** Exports */
module.exports = {
  sendPaymentRequest,
  handlePreChekoutQuery,
  sendInvoice,
  handleSuccess,
};
