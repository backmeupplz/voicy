# voicybot

## Source

https://github.com/backmeupplz/voicy

## Usage

```
docker create \
  --name=voicybot \
  -e PUID=1000 \
  -e PGID=1000 \
  -v </path/to/config>:/config \
  --restart always \
  tsubus/voicybot
```

## Configuration

Put your .env file in /config/voicybot/.env. A sample can be seen at https://github.com/backmeupplz/voicy/blob/master/.env.sample
