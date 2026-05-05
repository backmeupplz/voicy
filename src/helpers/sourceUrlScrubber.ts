import { TranscriptionJobModel } from '@/models/TranscriptionJob'
import { VoiceModel } from '@/models/Voice'
import { telegramBotTokenUrlPattern } from '@/helpers/sourceUrlSecurity'

export type SourceUrlScrubResult = {
  transcriptionJobs: {
    matched: number
    modified: number
  }
  voices: {
    matched: number
    modified: number
  }
  dryRun: boolean
}

export async function scrubTokenBearingSourceUrls(
  dryRun = false
): Promise<SourceUrlScrubResult> {
  const transcriptionJobFilter = {
    sourceUrl: telegramBotTokenUrlPattern,
  }
  const voiceFilter = {
    url: telegramBotTokenUrlPattern,
  }

  const [transcriptionJobCount, voiceCount] = await Promise.all([
    TranscriptionJobModel.countDocuments(transcriptionJobFilter),
    VoiceModel.countDocuments(voiceFilter),
  ])

  if (dryRun) {
    return {
      transcriptionJobs: { matched: transcriptionJobCount, modified: 0 },
      voices: { matched: voiceCount, modified: 0 },
      dryRun,
    }
  }

  const [transcriptionJobUpdate, voiceUpdate] = await Promise.all([
    TranscriptionJobModel.updateMany(transcriptionJobFilter, {
      $unset: { sourceUrl: '' },
    }),
    VoiceModel.updateMany(voiceFilter, { $unset: { url: '' } }),
  ])

  return {
    transcriptionJobs: {
      matched: transcriptionJobCount,
      modified: transcriptionJobUpdate.modifiedCount || 0,
    },
    voices: {
      matched: voiceCount,
      modified: voiceUpdate.modifiedCount || 0,
    },
    dryRun,
  }
}
