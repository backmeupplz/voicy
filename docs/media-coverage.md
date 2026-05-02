# Voicy media transcription coverage

Voicy queues Telegram media by file metadata and leaves format normalization to
the worker host, where ffmpeg or other local tooling is expected to be
available.

## Telegram intake

| Telegram surface | Queued | Notes |
| --- | --- | --- |
| Voice message | Yes | Native Telegram voice payload. |
| Video note | Yes | Circular video messages are queued as `video_note`. |
| Video message | Yes | Telegram `video` messages are queued as `video`. |
| Audio message | Yes | Telegram `audio` messages are queued directly. |
| Document upload | Yes, when media-like | Documents are accepted when MIME is audio/video, a known audio/video application MIME, a transcribable filename extension, or an unknown octet-stream without a filename. |
| Non-media document | No | Documents such as PDF files are ignored by media intake. |

## Container hints

| Format/container | Intake signal | Worker filename hint |
| --- | --- | --- |
| Ogg/Opus | `audio/ogg`, `audio/opus`, `.ogg`, `.oga`, `.opus`, Telegram voice URL fallback | `.ogg` or `.opus` |
| MP3/MPEG audio | `audio/mpeg`, `.mp3` | `.mp3` |
| WAV | `audio/wav`, `audio/x-wav`, `.wav`, `.wave` | `.wav` |
| M4A/AAC/MP4 audio | `audio/mp4`, `audio/aac`, `.m4a`, `.m4b`, `.aac` | `.m4a` or `.aac` |
| FLAC | `audio/flac`, `.flac` | `.flac` |
| WebM | `audio/webm`, `video/webm`, `.webm`, `.weba` | `.webm` |
| MP4 video | `video/mp4`, `application/mp4`, `.mp4`, Telegram video/video-note fallback | `.mp4` |
| MOV/QuickTime | `video/quicktime`, `.mov` | `.mov` |
| MKV | `video/x-matroska`, `.mkv`, `.mka` | `.mkv` |
| AVI | `video/x-msvideo`, `.avi` | `.avi` |
| 3GP | `video/3gpp`, `.3gp`, `.3gpp` | `.3gp` |

## Verified coverage

Automated proof currently verifies media classification for Telegram audio,
Telegram video, supported media documents, rejected PDF documents, and worker
extension selection for FLAC, filename-derived WebM, and default Telegram video
sources. Live Telegram client upload coverage should be recorded separately when
run against a deployed bot and worker.
