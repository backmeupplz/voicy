#!/usr/bin/env python3
"""Apple Silicon transcriber for the Voicy worker (mlx-whisper on the GPU).

Usage: mlx-whisper-transcriber.py {input} {output} {language} {model}
Writes the same JSON shape as the Windows faster-whisper transcribe.py.
Needs: pip install mlx-whisper faster-whisper (the latter for decoding + VAD).
"""
import json
import sys

import mlx_whisper
import numpy as np
from faster_whisper.audio import decode_audio
from faster_whisper.vad import (
    SpeechTimestampsMap,
    collect_chunks,
    get_speech_timestamps,
)
from mlx_whisper.tokenizer import LANGUAGES

SAMPLE_RATE = 16000

input_path, output_path = sys.argv[1], sys.argv[2]
language = (sys.argv[3] if len(sys.argv) > 3 else "").lower() or None
model = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else "large-v3-turbo"
if language not in LANGUAGES:  # "auto", "" and unknown hints mean auto-detect
    language = None
repo = model if "/" in model else f"mlx-community/whisper-{model}"

audio = decode_audio(input_path, sampling_rate=SAMPLE_RATE)
# Same Silero VAD as faster-whisper's vad_filter on the Windows worker: turbo
# hallucinates on silence ("Thank you.") and its no_speech_prob stays at 0.
speech = get_speech_timestamps(audio)
parts = []
detected_language = None
if speech:
    result = mlx_whisper.transcribe(
        np.concatenate(collect_chunks(audio, speech)[0]),
        path_or_hf_repo=repo,
        language=language,
    )
    detected_language = result.get("language")
    timestamps = SpeechTimestampsMap(speech, SAMPLE_RATE)
    for segment in result["segments"]:
        text = segment["text"].strip()
        if text:
            start = int(timestamps.get_original_time(segment["start"]))
            minutes, seconds = divmod(start, 60)
            parts.append({"timeCode": f"{minutes:02d}:{seconds:02d}", "text": text})

with open(output_path, "w", encoding="utf-8") as output:
    json.dump(
        {
            "text": " ".join(part["text"] for part in parts),
            "parts": parts,
            "language": detected_language,
            "duration": len(audio) / SAMPLE_RATE,
            "metadata": {"model": model, "device": "mlx"},
        },
        output,
        ensure_ascii=False,
    )
