import * as express from 'express'
import {
  activatePaidCheckoutSession,
  requireStripeWebhookSigningSecret,
} from '@/helpers/stripeCheckoutActivation'
import { stripe } from '@/helpers/stripe'
import Stripe from 'stripe'
import workerRouter from '@/helpers/workerApi/router'

export const webhookApp = express()
const endpointSecret = requireStripeWebhookSigningSecret()

webhookApp.use('/worker/v1', workerRouter)

webhookApp.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (request, response) => {
    const sig = request.headers['stripe-signature']

    let event: Stripe.Event

    try {
      if (!sig) {
        throw new Error('Missing stripe-signature header')
      }
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret)
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`)
      return
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      try {
        await activatePaidCheckoutSession(
          event.data.object as Stripe.Checkout.Session
        )
      } catch (error) {
        console.error('Failed to activate Stripe checkout session', error)
        response.status(500).send('Webhook activation failed')
        return
      }
    }
    // Return a 200 response to acknowledge receipt of the event
    response.send()
  }
)
