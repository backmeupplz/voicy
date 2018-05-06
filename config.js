/**
 * Configuration file
 *
 * @module config
 * @license MIT
 */

console.log(process.env.WIT_LANGUAGES);

module.exports = {
  token: process.env.VOICY_TELEGRAM_API_KEY,
  salt: process.env.VOICY_RANDOM_SALT,
  database: process.env.VOICY_MONGO_DB_URL,
  production_url: process.env.VOICY_URL,
  ssh_rsa_path: process.env.SSH_RSA_PATH,
  ssh_auth_sock: process.env.SSH_AUTH_SOCK,
  ssl_certificate_path: process.env.SSL_CERTIFICATE_PATH,
  ssl_key_path: process.env.SSL_KEY_PATH,
  should_use_webhooks: process.env.USE_WEBHOOKS || false,
  webhook_callback_url: process.env.WEBHOOK_CALLBACK_URL,
  botan_token: process.env.BOTAN_TOKEN,
  g_cloud_project_id: process.env.G_CLOUD_PROJECT_ID,
  wit_languages: JSON.parse(process.env.WIT_LANGUAGES),
  telegram_payments_token: process.env.TELEGRAM_PAYMENTS_TOKEN,
  admin_id: process.env.ADMIN_ID,
  yandex_key: process.env.YANDEX_KEY,
};
