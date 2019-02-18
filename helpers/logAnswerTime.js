module.exports = function logAnswerTime(ctx, name) {
  console.info(
    `${name} answered in ${(new Date().getTime() - ctx.timeReceived.getTime()) /
      1000}s`
  )
}
