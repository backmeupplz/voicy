#!/usr/bin/env python3
"""CUDA transcriber for the Voicy worker (faster-whisper).

One-shot: faster-whisper-transcriber.py {input} {output} {language} {model}
Server:   faster-whisper-transcriber.py --serve
  Keeps the model loaded. Reads one JSON request per stdin line
  ({"input", "output", "language", "model"}), writes the transcript to
  "output" and answers one JSON line ({"ok": true} or {"ok": false,
  "error": "..."}) on stdout. Exits when stdin closes, freeing VRAM.
"""
import json
import os
import site
import sys
import traceback
from pathlib import Path

for package_root in site.getsitepackages():
    for relative in ("nvidia/cublas/bin", "nvidia/cudnn/bin", "nvidia/cuda_nvrtc/bin"):
        dll_dir = Path(package_root) / relative
        if dll_dir.exists():
            os.add_dll_directory(str(dll_dir))
            os.environ["PATH"] = str(dll_dir) + os.pathsep + os.environ.get("PATH", "")

from faster_whisper import BatchedInferencePipeline, WhisperModel
from faster_whisper.audio import decode_audio
from faster_whisper.tokenizer import _LANGUAGE_CODES

SAMPLE_RATE = 16000
# int8_float16 halves VRAM but measured 15-20% slower on the 4070 Ti.
COMPUTE_TYPE = "float16"
# Longer audio goes through the batched pipeline: VAD chunks decode in
# parallel instead of one 30 s window after another (~3.4x faster on 1-13 min
# notes on the 4070 Ti; short notes gain nothing).
BATCHED_MIN_SECONDS = 60
BATCH_SIZE = 16

models = {}


def pipelines(name):
    if name not in models:
        model = WhisperModel(
            name,
            device="cuda",
            compute_type=COMPUTE_TYPE,
            download_root=os.environ.get("VOICY_WHISPER_MODEL_DIR"),
        )
        models[name] = (model, BatchedInferencePipeline(model))
    return models[name]


def transcribe(input_path, output_path, language, model_name):
    model_name = model_name or "large-v3"
    if language not in _LANGUAGE_CODES:  # "auto", "" and unknown hints mean auto-detect
        language = None
    model, batched = pipelines(model_name)
    audio = decode_audio(input_path, sampling_rate=SAMPLE_RATE)
    duration = len(audio) / SAMPLE_RATE
    if duration >= BATCHED_MIN_SECONDS:
        segments, info = batched.transcribe(
            audio, language=language, batch_size=BATCH_SIZE, without_timestamps=False
        )
    else:
        segments, info = model.transcribe(audio, language=language, vad_filter=True)
    parts = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            minutes, seconds = divmod(int(segment.start), 60)
            parts.append({"timeCode": f"{minutes:02d}:{seconds:02d}", "text": text})
    with open(output_path, "w", encoding="utf-8") as output:
        json.dump(
            {
                "text": " ".join(part["text"] for part in parts),
                "parts": parts,
                "language": info.language,
                "duration": duration,
                "metadata": {
                    "model": model_name,
                    "device": "cuda",
                    "computeType": COMPUTE_TYPE,
                    "batched": duration >= BATCHED_MIN_SECONDS,
                },
            },
            output,
            ensure_ascii=False,
        )


def serve():
    stdin = open(sys.stdin.fileno(), encoding="utf-8", closefd=False)
    for line in stdin:
        try:
            request = json.loads(line)
            transcribe(
                request["input"],
                request["output"],
                request.get("language"),
                request.get("model"),
            )
            reply = {"ok": True}
        except Exception as error:  # report and keep the model loaded
            traceback.print_exc()
            reply = {"ok": False, "error": f"{type(error).__name__}: {error}"}
        sys.stdout.write(json.dumps(reply) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    if sys.argv[1:] == ["--serve"]:
        serve()
    else:
        args = sys.argv[1:] + [None] * 4
        transcribe(args[0], args[1], args[2], args[3])
