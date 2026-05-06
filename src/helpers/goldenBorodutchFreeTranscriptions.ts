import { GoldenBorodutchFreeTranscriptionModel } from '@/models/GoldenBorodutchFreeTranscription'
import { isDonationWallEnabled } from '@/helpers/donationWall'

export enum TranscriptionAccessDenialReason {
  subscriptionRequired = 'subscription_required',
  freeAllowanceExhausted = 'free_allowance_exhausted',
  membershipCheckFailed = 'membership_check_failed',
  missingUser = 'missing_user',
}

export interface TranscriptionAccessResult {
  allowed: boolean
  consumedFreeTranscription: boolean
  reason?: TranscriptionAccessDenialReason
  used?: number
  remaining?: number
}

interface ChatAccessState {
  paid?: boolean
}

interface TelegramApi {
  getChatMember(
    chatId: string,
    userId: number
  ): Promise<{ status: string; is_member?: boolean }>
}

interface GoldenBorodutchSettings {
  chatId: string
  freeTranscriptionLimit: number
}

interface MembershipCheck {
  allowed: boolean
  status?: string
  checkedAt: Date
  error?: string
}

export interface FreeTranscriptionRecord {
  transcriptionsUsed: number
}

export interface FreeTranscriptionStore {
  recordMembershipCheck(
    telegramUserId: string,
    membership: MembershipCheck
  ): Promise<void>
  consumeFreeTranscription(
    telegramUserId: string,
    limit: number,
    membership: MembershipCheck
  ): Promise<FreeTranscriptionRecord | undefined>
  freeTranscriptionRecord(
    telegramUserId: string
  ): Promise<FreeTranscriptionRecord | undefined>
  refundFreeTranscription(telegramUserId: string): Promise<void>
}

export function goldenBorodutchSettings(
  env: NodeJS.ProcessEnv = process.env
): GoldenBorodutchSettings {
  return {
    chatId: env.VOICY_GOLDEN_BORODUTCH_CHAT_ID || '@golden_borodutch',
    freeTranscriptionLimit: numberFromEnv(
      env.VOICY_GOLDEN_BORODUTCH_FREE_TRANSCRIPTION_LIMIT,
      50
    ),
  }
}

export async function checkTranscriptionAccess({
  chat,
  telegramUserId,
  telegramApi,
  env = process.env,
  settings = goldenBorodutchSettings(env),
  store = mongoFreeTranscriptionStore,
}: {
  chat: ChatAccessState
  telegramUserId?: string
  telegramApi: TelegramApi
  env?: NodeJS.ProcessEnv
  settings?: GoldenBorodutchSettings
  store?: FreeTranscriptionStore
}): Promise<TranscriptionAccessResult> {
  if (!isDonationWallEnabled(env) || chat.paid) {
    return { allowed: true, consumedFreeTranscription: false }
  }

  if (!telegramUserId) {
    return {
      allowed: false,
      consumedFreeTranscription: false,
      reason: TranscriptionAccessDenialReason.missingUser,
    }
  }

  const membership = await checkGoldenBorodutchMembership(
    telegramApi,
    settings.chatId,
    telegramUserId
  )

  if (!membership.allowed) {
    await store.recordMembershipCheck(telegramUserId, membership)
    return {
      allowed: false,
      consumedFreeTranscription: false,
      reason:
        membership.error && !isExpectedNonMemberError(membership.error)
          ? TranscriptionAccessDenialReason.membershipCheckFailed
          : TranscriptionAccessDenialReason.subscriptionRequired,
    }
  }

  const record = await store.consumeFreeTranscription(
    telegramUserId,
    settings.freeTranscriptionLimit,
    membership
  )
  if (!record) {
    const currentRecord = await store.freeTranscriptionRecord(telegramUserId)
    return {
      allowed: false,
      consumedFreeTranscription: false,
      reason: TranscriptionAccessDenialReason.freeAllowanceExhausted,
      used: currentRecord?.transcriptionsUsed,
      remaining: 0,
    }
  }

  return {
    allowed: true,
    consumedFreeTranscription: true,
    used: record.transcriptionsUsed,
    remaining: Math.max(
      settings.freeTranscriptionLimit - record.transcriptionsUsed,
      0
    ),
  }
}

export function refundGoldenBorodutchFreeTranscription(
  telegramUserId: string,
  store: FreeTranscriptionStore = mongoFreeTranscriptionStore
) {
  return store.refundFreeTranscription(telegramUserId)
}

async function checkGoldenBorodutchMembership(
  telegramApi: TelegramApi,
  chatId: string,
  telegramUserId: string
): Promise<MembershipCheck> {
  const checkedAt = new Date()
  try {
    const member = await telegramApi.getChatMember(
      chatId,
      Number(telegramUserId)
    )
    return {
      allowed: isActiveTelegramMember(member),
      status: member.status,
      checkedAt,
    }
  } catch (error) {
    return {
      allowed: false,
      checkedAt,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function isActiveTelegramMember(member: {
  status: string
  is_member?: boolean
}) {
  return (
    ['creator', 'administrator', 'member'].includes(member.status) ||
    (member.status === 'restricted' && member.is_member === true)
  )
}

function isExpectedNonMemberError(error: string) {
  const normalized = error.toLowerCase()
  return [
    'user not found',
    'participant_id_invalid',
    'user_not_participant',
    'chat member not found',
  ].some((expectedError) => normalized.includes(expectedError))
}

const mongoFreeTranscriptionStore: FreeTranscriptionStore = {
  async recordMembershipCheck(telegramUserId, membership) {
    await GoldenBorodutchFreeTranscriptionModel.updateOne(
      { telegramUserId },
      membershipUpdate(telegramUserId, membership),
      { upsert: true }
    ).exec()
  },

  async consumeFreeTranscription(telegramUserId, limit, membership) {
    await GoldenBorodutchFreeTranscriptionModel.updateOne(
      { telegramUserId },
      {
        $setOnInsert: {
          telegramUserId,
          transcriptionsUsed: 0,
        },
      },
      { upsert: true }
    ).exec()

    const record = await GoldenBorodutchFreeTranscriptionModel.findOneAndUpdate(
      { telegramUserId, transcriptionsUsed: { $lt: limit } },
      {
        $inc: { transcriptionsUsed: 1 },
        ...membershipUpdate(telegramUserId, membership),
      },
      { new: true }
    ).exec()
    return record
      ? { transcriptionsUsed: record.transcriptionsUsed }
      : undefined
  },

  async freeTranscriptionRecord(telegramUserId) {
    const record = await GoldenBorodutchFreeTranscriptionModel.findOne({
      telegramUserId,
    }).exec()
    return record
      ? { transcriptionsUsed: record.transcriptionsUsed }
      : undefined
  },

  async refundFreeTranscription(telegramUserId) {
    await GoldenBorodutchFreeTranscriptionModel.updateOne(
      { telegramUserId, transcriptionsUsed: { $gt: 0 } },
      { $inc: { transcriptionsUsed: -1 } }
    ).exec()
  },
}

function membershipUpdate(telegramUserId: string, membership: MembershipCheck) {
  return {
    $set: {
      telegramUserId,
      lastMembershipAllowed: membership.allowed,
      lastMembershipStatus: membership.status,
      lastMembershipCheckedAt: membership.checkedAt,
      lastMembershipError: membership.error,
    },
  }
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
