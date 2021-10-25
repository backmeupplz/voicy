import { unlinkSync } from 'fs'
import report from '@/helpers/report'

export default function deleteFile(path) {
  try {
    unlinkSync(path)
  } catch (error) {
    report(error, { location: 'deleteFile' })
  }
}
