# voicybot

## Source

https://github.com/backmeupplz/voicy

## Usage

```
docker build -t alexeym/lehabot-node .
docker create --name=voicybot  -e PUID=1000 -e PGID=1000  -v /config:/config --restart always  alexeym/lehabot-node
```

## Configuration

Put your .env file in /config/voicybot/.env. A sample can be seen at https://github.com/backmeupplz/voicy/blob/master/.env.sample
