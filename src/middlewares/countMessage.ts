import { NextFunction } from 'grammy'
import Context from '@/models/Context'
import incrementMessageCount from '@/helpers/incrementMessageCount'

export default function countMessage(_: Context, next: NextFunction) {
  incrementMessageCount()
  return next()
}
