import { unlinkSync } from 'fs'

export default function deleteFile(path: string) {
  try {
    unlinkSync(path)
  } catch (error) {
    // do nothing, probably file doesn't exist already
  }
}
