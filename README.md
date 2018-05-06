[![Voicybot](/img/logo.png?raw=true)](http://voicybot.com/)

# [@voicybot](https://t.me/voicybot) main repository
This repository contains the code for one of the most popular bots I've ever built for Telegram — [@voicybot](https://t.me/voicybot). Please, feel free to fork, add features and create pull requests so that everybody (around 500 000 chats) can experience the features you've built.

# List of repositories
* [Voicy](https://github.com/backmeupplz/voicy) — the main [@voicybot](https://t.me/voicybot) code
* [Voicy localizations](https://github.com/backmeupplz/voicy-localizations) — the list of localized strings for [@voicybot](https://t.me/voicybot)
* [Voicy payments](https://github.com/backmeupplz/voicy-payments) — payments service that used stripe to process payments for the Google Speech seconds of recognition; currently retired as a stats server for [voicybot.com](http://voicybot.com)
* [Voicy landing](https://github.com/backmeupplz/voicy-landing) — [voicybot.com](http://voicybot.com) landing page


# Installation and local launch
1. Clone this repo: `git clone https://github.com/backmeupplz/voicy`
2. Launch the [mongo database](https://www.mongodb.com/) locally
3. Create `.env` file with `BOTAN_TOKEN`, `VOICY_MONGO_DB_URL`, `VOICY_TELEGRAM_API_KEY`, `VOICY_RANDOM_SALT`, `G_CLOUD_PROJECT_ID`, `TELEGRAM_PAYMENTS_TOKEN`, `ADMIN_ID`, and `YANDEX_KEY`
4. Add Google credentials certificate to `certificates/voicy.json`; you need to create Google service account with access to your Google Cloud project and then [get the credentials](https://cloud.google.com/genomics/downloading-credentials-for-api-access)
4. Run `npm i` in the root folder
5. Run `npm run start`

# Environment variables in `.env` file
* `BOTAN_TOKEN` — token for [botan.io](http://botan.io) analytics service
* `VOICY_MONGO_DB_URL` — url for the mongo database used for Voicy, may include credentials
* `VOICY_TELEGRAM_API_KEY` — telegram bot token for Voicy
* `VOICY_RANDOM_SALT` — random salt to generate various encrypted things
* `G_CLOUD_PROJECT_ID` — Google Cloud services project id for temporary file storage at Google Buckets and Google Speech voicy recognition
* `TELEGRAM_PAYMENTS_TOKEN` — telegram bot payments token; no longer used as payments have retired
* `ADMIN_ID` — chat id of the person who shall receive valuable logs
* `YANDEX_KEY` — key for Yandex SpeechKit voice recognition service 
* `WIT_LANGUAGES` — A map of language names to Wit.ai tokens

# Continuous integration
Any commit pushed to master gets deployed to [@voicybot](https://t.me/voicybot) via [CI Ninja](https://github.com/backmeupplz/ci-ninja).

# License
MIT — use for any purpose. Would be great if you could leave a note about the original developers. Thanks!

# As seen on
[![Habrahabr](/img/habr.png?raw=true)](https://habrahabr.ru/post/316824/)
[![Spark](/img/spark.png?raw=true)](https://spark.ru/startup/voicy/blog/19008/kak-zapustit-proekt-v-odinochku/)
[![Reddit](/img/reddit.png?raw=true)](https://redd.it/5iduzy)
[![Bot Store](/img/bs.png?raw=true)](https://storebot.me/bot/voicybot)
[![Product Hunt](/img/ph.png?raw=true)](https://www.producthunt.com/posts/voicy)
