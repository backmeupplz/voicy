const telegramAllowedUpdates = [
  'message',
  'edited_message',
  'guest_message',
  'callback_query',
  'my_chat_member',
] as const

export default telegramAllowedUpdates as readonly string[]
