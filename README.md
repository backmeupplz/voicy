[![Voicybot](/img/logo.png?raw=true)](https://voicybot.com/)

# [@voicybot](https://t.me/voicybot) main repository

This repository contains the code for one of the most popular bots I've ever built for Telegram — [@voicybot](https://t.me/voicybot). Please, feel free to fork, add features and create pull requests so that everybody (over 12 000 000 people) can experience the features you've built.

You can also help by translating the bot to other languages or fixing some texts in existing languages by modifying the `locales` folder or at [localize.borodutch.com](https://localize.borodutch.com).

## List of repositories

- [voicy](https://github.com/backmeupplz/voicy) — the main [@voicybot](https://t.me/voicybot) code
- [voicy-payments](https://github.com/backmeupplz/voicy-payments) — payments service that used stripe to process payments for the Google Speech seconds of recognition; currently retired as the stats server for [voicybot.com](https://voicybot.com)
- [voicy-landing](https://github.com/backmeupplz/voicy-landing) — [borodutch.com](https://borodutch.com) landing page
- [voicy-recognition](https://github.com/backmeupplz/voicy-recognition/) — Recognition service for [voicybot.com](https://voicybot.com)

## Installation and local launch

1. Clone this repo: `git clone https://github.com/backmeupplz/voicy`
2. Launch a [mongo database](https://www.mongodb.com/) locally
3. Create `.env` file with the environment variables listed below
4. Install `ffmpeg` on your machine
5. Run `yarn` in the root folder
6. Run `yarn start`

## Environment variables in `.env` file

| Variable        | Description                                                     |
| --------------- | --------------------------------------------------------------- |
| `MONGO`         | URI for the mongo database used                                 |
| `TOKEN`         | Telegram bot token                                              |
| `SALT`          | Random salt to generate various encrypted stuff                 |
| `ADMIN_ID`      | Chat id of the person who shall receive valuable logs           |
| `WIT_LANGUAGES` | A map of language names to Wit.ai tokens                        |
| `ENVIRONMENT`   | App environment, can be `development`, defaults to `production` |

See examples in `.env.sample` file.

## Continuous integration

Any commit pushed to `main` gets deployed to [@voicybot](https://t.me/voicybot) via [CI Ninja](https://github.com/backmeupplz/ci-ninja).

## License

MIT — use for any purpose. Would be great if you could leave a note about the original developers. Thanks!

## As seen on

[![Habrahabr](/img/habr.png?raw=true)](https://habrahabr.ru/post/316824/)
[![Spark](/img/spark.png?raw=true)](https://spark.ru/startup/voicy/blog/19008/kak-zapustit-proekt-v-odinochku/)
[![Reddit](/img/reddit.png?raw=true)](https://redd.it/5iduzy)
[![Bot Store](/img/bs.png?raw=true)](https://storebot.me/bot/voicybot)
[![Product Hunt](/img/ph.png?raw=true)](https://www.producthunt.com/posts/voicy)
