export function maxMediaFileSizeBytes() {
  const configuredMb = Number(process.env.VOICY_MAX_MEDIA_FILE_SIZE_MB || 2048)
  if (!Number.isFinite(configuredMb) || configuredMb <= 0) {
    return undefined
  }
  return configuredMb * 1024 * 1024
}

export function isMediaTooLarge(fileSize?: number) {
  const limit = maxMediaFileSizeBytes()
  return Boolean(limit && fileSize && fileSize >= limit)
}
