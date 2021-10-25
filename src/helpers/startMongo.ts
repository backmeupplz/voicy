import { connect } from 'mongoose'

export default async function startMongo() {
  return connect(process.env.MONGO, {
    socketTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  })
}
