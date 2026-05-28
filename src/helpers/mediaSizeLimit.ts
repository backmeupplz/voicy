export const MAX_MEDIA_FILE_SIZE_MB = 100
export const MAX_MEDIA_FILE_SIZE_BYTES = MAX_MEDIA_FILE_SIZE_MB * 1024 * 1024

export function maxMediaFileSizeBytes() {
  const configuredMb = Number(
    process.env.VOICY_MAX_MEDIA_FILE_SIZE_MB || MAX_MEDIA_FILE_SIZE_MB
  )
  if (!Number.isFinite(configuredMb) || configuredMb <= 0) {
    return MAX_MEDIA_FILE_SIZE_BYTES
  }
  return Math.min(configuredMb, MAX_MEDIA_FILE_SIZE_MB) * 1024 * 1024
}

export function isMediaTooLarge(fileSize?: number) {
  const limit = maxMediaFileSizeBytes()
  return Boolean(limit && fileSize && fileSize > limit)
}
