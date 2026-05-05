type DonationWallEnv = Record<string, string | undefined>

function isDonationWallEnabled(env: DonationWallEnv = process.env) {
  const configured = env.VOICY_DONATION_WALL_ENABLED
  if (!configured) {
    return false
  }

  return ['1', 'true', 'yes', 'on'].includes(configured.trim().toLowerCase())
}

function isTranscriptionAllowedByDonationWall(
  chat: { paid?: boolean },
  env: DonationWallEnv = process.env
) {
  return !isDonationWallEnabled(env) || Boolean(chat.paid)
}

export { isDonationWallEnabled, isTranscriptionAllowedByDonationWall }
