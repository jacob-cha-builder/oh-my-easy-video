#!/usr/bin/env python3
"""SCRIPT.md -> per-line wav via MeloTTS (Korean).

Companion to melo-tts.mjs. Parses SCRIPT.md the same way ko-tts.mjs /
parse-plan.mjs does (## Line N -- Label (Frame N) headings, indented spoken
block), synthesizes each line with MeloTTS's KR checkpoint, and writes one
wav per line under audio/ -- the same layout ko-tts.mjs produces. melo-tts.mjs
takes over from here (ffprobe duration + whisper word timestamps +
audio_meta.json), exactly as it would for a Piper-produced wav.

Usage: python3 melo_synth.py --project <dir> [--speed 1.0]
"""
import argparse
import json
import re
import sys
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--project", default=".")
parser.add_argument("--speed", type=float, default=1.0)
args = parser.parse_args()

project_dir = Path(args.project).resolve()
script_path = project_dir / "SCRIPT.md"
out_dir = project_dir / "audio"
out_dir.mkdir(parents=True, exist_ok=True)

if not script_path.exists():
    print(f"[FATAL] {script_path} does not exist.", file=sys.stderr)
    sys.exit(2)

text = script_path.read_text(encoding="utf-8")
blocks = re.split(r"^##\s+", text, flags=re.MULTILINE)[1:]

lines = []
for idx, block in enumerate(blocks):
    head = block.split("\n", 1)[0]
    n_match = re.search(r"Line\s+(\d+)", head, re.IGNORECASE)
    f_match = re.search(r"Frame\s+(\d+)", head, re.IGNORECASE)
    body = block[len(head):]
    indented = [
        l[4:] if l.startswith("    ") else l[1:]
        for l in body.split("\n")
        if re.match(r"^(\t| {4,})\S", l)
    ]
    spoken = " ".join(x.strip() for x in indented).strip()
    if not spoken:
        continue
    lines.append({
        "n": int(n_match.group(1)) if n_match else idx + 1,
        "frame": int(f_match.group(1)) if f_match else None,
        "text": spoken,
    })

if not lines:
    print(f"[FATAL] No spoken lines found in {script_path}.", file=sys.stderr)
    sys.exit(2)

print("loading MeloTTS KR model...", file=sys.stderr)
from melo.api import TTS  # noqa: E402  (heavy import, deferred past arg parsing)

model = TTS(language="KR", device="cpu")
speaker_id = dict(model.hps.data.spk2id.items())["KR"]

results = []
for line in lines:
    name = f"line-{line['n']:02d}.wav"
    wav_path = out_dir / name
    print(f"  {line['n']:>2}. {line['text'][:42]}", file=sys.stderr)
    model.tts_to_file(line["text"], speaker_id, str(wav_path), speed=args.speed)
    results.append({"n": line["n"], "frame": line["frame"], "text": line["text"], "path": f"audio/{name}"})

print(json.dumps({"lines": results}))
