import { Context as BaseContext } from 'grammy'
import { Chat } from '@/models/Chat'
import { DocumentType } from '@typegoose/typegoose'
import { I18nContext } from '@grammyjs/i18n/dist/source'

export default interface Context extends BaseContext {
  readonly i18n: I18nContext
  dbchat: DocumentType<Chat>
  timeReceived: Date
}
