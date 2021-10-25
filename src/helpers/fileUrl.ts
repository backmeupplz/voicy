import { escape } from 'querystring'

export default function fileUrl(filePath: string) {
  return `https://api.telegram.org/file/bot${process.env.TOKEN}/${escape(
    filePath
  )}`
}
