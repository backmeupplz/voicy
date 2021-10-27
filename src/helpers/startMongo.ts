import { connect } from 'mongoose'

export default function startMongo() {
  return connect(process.env.MONGO)
}
