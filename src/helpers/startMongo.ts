import { connect } from 'mongoose'

export default function startMongo() {
  return connect(process.env.MONGO, {
    socketTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  })
}
