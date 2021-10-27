import Context from '@/models/Context'

export default function logAnswerTime(ctx: Context, name: string) {
  console.info(
    `${name} answered in ${
      (new Date().getTime() - ctx.timeReceived.getTime()) / 1000
    }s`
  )
}
