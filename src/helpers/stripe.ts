import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Keep requests on the account API version this bot already used.
  apiVersion: '2022-08-01' as Stripe.LatestApiVersion,
})
