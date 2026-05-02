const token = process.env.TELEGRAM_TEST_BOT_TOKEN || process.env.TOKEN
const expectedUsername = process.env.TELEGRAM_TEST_BOT_USERNAME

function fail(message, details = {}) {
  const error = new Error(message)
  error.details = details
  throw error
}

async function telegram(method, params = {}) {
  if (!token) {
    fail('TELEGRAM_TEST_BOT_TOKEN or TOKEN is required')
  }

  const url = new URL(`https://api.telegram.org/bot${token}/${method}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url)
  const body = await response.json().catch(async () => ({
    ok: false,
    description: await response.text(),
  }))

  return { status: response.status, body }
}

async function main() {
  const me = await telegram('getMe')
  if (!me.body.ok) {
    fail('Telegram getMe failed', { status: me.status, response: me.body })
  }

  const username = me.body.result.username
  if (expectedUsername && username !== expectedUsername.replace(/^@/, '')) {
    fail('Telegram token points at an unexpected bot', {
      expectedUsername,
      actualUsername: username,
    })
  }

  const webhook = await telegram('getWebhookInfo')
  if (!webhook.body.ok) {
    fail('Telegram getWebhookInfo failed', {
      status: webhook.status,
      response: webhook.body,
    })
  }

  const webhookInfo = webhook.body.result
  if (
    Array.isArray(webhookInfo.allowed_updates) &&
    !webhookInfo.allowed_updates.includes('callback_query')
  ) {
    fail('Telegram runtime is not subscribed to callback_query updates', {
      bot: `@${username}`,
      allowed_updates: webhookInfo.allowed_updates,
      pending_update_count: webhookInfo.pending_update_count,
    })
  }

  if (webhookInfo.url) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          bot: `@${username}`,
          runtime: 'webhook',
          webhook_url: webhookInfo.url,
          pending_update_count: webhookInfo.pending_update_count,
        },
        null,
        2
      )
    )
    return
  }

  if (webhookInfo.pending_update_count === 0) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          bot: `@${username}`,
          runtime: 'long-polling-or-idle-local-qa',
          pending_update_count: 0,
          proof:
            'No webhook is configured and Telegram reports no pending backlog',
        },
        null,
        2
      )
    )
    return
  }

  fail('No webhook is configured and Telegram reports pending updates', {
    bot: `@${username}`,
    pending_update_count: webhookInfo.pending_update_count,
  })
}

main().catch((error) => {
  console.error(error.message)
  if (error.details) {
    console.error(JSON.stringify(error.details, null, 2))
  }
  process.exit(1)
})
