import Context from '@/models/Context'

interface ExtraErrorInfo {
  ctx?: Context
  location?: string
  meta?: string
}

export default function report(error: Error, info: ExtraErrorInfo = {}) {
  console.log(error, info)
}
