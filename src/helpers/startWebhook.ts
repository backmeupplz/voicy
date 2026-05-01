import * as express from 'express'
import { ChatModel } from '@/models/Chat'
import { stripe } from '@/helpers/stripe'
import workerRouter from '@/helpers/workerApi/router'

export const webhookApp = express()
const endpointSecret = process.env.STRIPE_WEBHOOK_SIGNING_SECRET

webhookApp.use('/worker/v1', workerRouter)

webhookApp.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (request, response) => {
    const sig = request.headers['stripe-signature']

    let event

    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret)
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`)
      return
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const chatId = +event.data.object.client_reference_id
      const chat = await ChatModel.findOne({ id: chatId })
      if (chat) {
        chat.paid = true
        await chat.save()
      }
    }
    // Return a 200 response to acknowledge receipt of the event
    response.send()
  }
)
