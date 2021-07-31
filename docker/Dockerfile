FROM lsiobase/alpine:3.10

ARG VERSION="1.3"
ARG DATE="2020/05/18"
LABEL build_version="voicybot version:- ${VERSION}, ${DATE}"
LABEL maintainer="tsubus"

# set environment variables
ENV HOME="/config/voicybot"

# volume
VOLUME /config

# http://bugs.python.org/issue19846
# > At the moment, setting "LANG=C" on a Linux system *fundamentally breaks Python 3*, and that's not OK.
ENV LANG C.UTF-8

# install ca-certificates so that HTTPS works consistently
# other runtime dependencies for Python are installed later
RUN apk add --no-cache ca-certificates

# install packages
RUN \
 echo "**** install packages ****" && \
 echo 'http://dl-cdn.alpinelinux.org/alpine/v3.9/main' >> /etc/apk/repositories && \
 echo 'http://dl-cdn.alpinelinux.org/alpine/v3.9/community' >> /etc/apk/repositories && \
 apk update && \
 apk add --no-cache \
	python3 \
	git \
	yarn \
	ffmpeg \
	mongodb \
	screen && \
 git clone https://github.com/McMerphy/voicy.git /app/voicybot && \
 cd /app/voicybot && \
#  git checkout develop && \
 yarn install && \
 echo "**** cleanup ****" && \
 rm -rf \
    /root/.cache \
    /tmp/*

# add local files
COPY root/ /
