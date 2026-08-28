#!/usr/bin/env node
// 한국어 나레이션 생성기 — SCRIPT.md → wav + audio_meta.json
//
// HyperFrames 의 Kokoro 에는 한국어가 없다 (hexgrad/Kokoro-82M VOICES.md 기준 9개 언어).
// 이 스크립트는 상류 audio.mjs 를 고치지 않고, 같은 형식의 audio_meta.json 을 만들어
// Step 4 이후가 그대로 돌게 한다.
//
// 사용:
//   node ko-tts.mjs --project videos/<name> [--voice <path.onnx>] [--piper <bin>]
//
// 필요한 것:
//   piper  — pip install piper-tts  (또는 rhasspy/piper 바이너리)
//   음성   — github.com/jacob-cha-builder/hyperframes-ko  릴리즈 voices--v1
//   ffprobe — 길이 측정

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseScript } from './parse-plan.mjs';

// --no-words 는 값 없는 불리언 플래그라 --key value 페어 파서와 섞일 수 없다 — 먼저 떼어낸다.
const rawArgv = process.argv.slice(2);
const wantWords = !rawArgv.includes('--no-words');
const argv = rawArgv.filter((a) => a !== '--no-words');

const args = {};
for (let i = 0; i < argv.length; i += 2) {
  args[argv[i]?.replace(/^--/, '')] = argv[i + 1];
}

const projectDir = resolve(args.project ?? '.');
const scriptPath = join(projectDir, 'SCRIPT.md');
const outDir = join(projectDir, 'audio');
const metaPath = join(projectDir, 'audio_meta.json');

if (!existsSync(scriptPath)) {
  console.error(`[FATAL] ${scriptPath} 가 없습니다. Step 3 에서 SCRIPT.md 를 먼저 쓰세요.`);
  process.exit(2);
}

// ── piper 찾기 ───────────────────────────────────────────────────────────────
const findPiper = () => {
  if (args.piper) return { cmd: args.piper, pre: [] };
  if (process.env.PIPER_BIN) return { cmd: process.env.PIPER_BIN, pre: [] };
  if (process.env.PIPER_PYTHON) return { cmd: process.env.PIPER_PYTHON, pre: ['-m', 'piper'] };
  try {
    execFileSync('which', ['piper'], { stdio: 'pipe' });
    return { cmd: 'piper', pre: [] };
  } catch {
    return null;
  }
};

const piper = findPiper();
if (!piper) {
  console.error(
    `[FATAL] piper 를 찾을 수 없습니다.\n` +
      `  설치:  python3 -m venv .venv && .venv/bin/pip install piper-tts\n` +
      `  지정:  --piper <실행파일>  또는  PIPER_PYTHON=<venv>/bin/python\n`,
  );
  process.exit(2);
}

const voice = args.voice ?? process.env.PIPER_VOICE;
if (!voice || !existsSync(voice)) {
  console.error(
    `[FATAL] 한국어 음성 모델을 찾을 수 없습니다${voice ? ` (${voice})` : ''}.\n` +
      `  받기: github.com/jacob-cha-builder/hyperframes-ko/releases/download/voices--v1/ko_KR-kss-medium.onnx\n` +
      `        (같은 경로의 .onnx.json 도 함께 받아 나란히 두어야 한다)\n` +
      `  지정: --voice <path.onnx>  또는  PIPER_VOICE=<path.onnx>\n` +
      `  참고: 2026-08 기준 Piper 의 한국어 음성은 kss/medium 하나뿐입니다 (여성 단일 화자).\n`,
  );
  process.exit(2);
}

// ── SCRIPT.md 파싱 ───────────────────────────────────────────────────────────
const lines = parseScript(readFileSync(scriptPath, 'utf8'));
if (lines.length === 0) {
  console.error(`[FATAL] ${scriptPath} 에서 발화 줄을 찾지 못했습니다.`);
  console.error(`  형식: "## Line N — 라벨 (Frame N)" 아래 들여쓴 블록이 발화 텍스트입니다.`);
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
console.log(`▶ ${lines.length}줄 합성 — ${voice.split('/').pop()}\n`);

const durationOf = (wav) =>
  Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nk=1:nw=1', wav], { encoding: 'utf8' }).trim(),
  );

const whisperModel = args['whisper-model'] ?? 'small';

// wav 옆에 나란히 생기는 transcript.json 은 입력 파일명과 무관하게 고정된 이름이라
// (npx hyperframes transcribe --help 로 확인: -o/--output 은 srt/vtt 사이드카 전용, 원본 json 경로는 못 바꿈)
// 다음 줄을 돌리기 전에 즉시 읽어서 옮겨둬야 한다. 실패해도 배치 전체는 계속 진행한다 — 부분 성공 허용.
//
// whisper 는 타임스탬프만 신뢰한다 — 받아쓴 텍스트는 오독이 섞인다(실측: "AI로" → "8으로").
// 토큰 수가 원문의 공백 분리 어절 수와 같으면 원문 어절로 텍스트를 덮어쓴다. 다르면(드묾)
// whisper 텍스트를 그대로 두고 경고한다 — 이런 줄은 육안으로 words[] 를 확인해야 한다.
const transcribeWords = (wav, originalText) => {
  try {
    execFileSync('npx', ['hyperframes', 'transcribe', wav, '--model', whisperModel, '--language', 'ko', '--optional'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    console.error(`  ⚠ 단어 타임스탬프 실패 (${wav}): ${e.message.split('\n')[0]}`);
    return [];
  }
  const transcriptPath = join(dirname(wav), 'transcript.json');
  if (!existsSync(transcriptPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(transcriptPath, 'utf8'));
    const tokens = originalText.trim().split(/\s+/);
    if (raw.length !== tokens.length) {
      console.error(`  ⚠ ${wav}: whisper 토큰 수(${raw.length})가 원문 어절 수(${tokens.length})와 달라 ` +
        `받아쓴 텍스트를 그대로 둡니다 — words[] 를 육안으로 확인하세요`);
    }
    return raw.map((w, i) => ({ id: `w${i}`, text: raw.length === tokens.length ? tokens[i] : w.text, start: w.start, end: w.end }));
  } catch {
    return [];
  } finally {
    unlinkSync(transcriptPath); // 다음 줄이 같은 경로에 덮어쓰므로 여기서 걷어간다
  }
};

const voices = [];
let total = 0;
let wordsFilled = 0;

for (const line of lines) {
  const name = `line-${String(line.n).padStart(2, '0')}.wav`;
  const wav = join(outDir, name);
  try {
    execFileSync(piper.cmd, [...piper.pre, '--model', voice, '--output-file', wav], {
      input: line.text,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    console.error(`\n✘ ${line.n}번 줄 합성 실패: ${e.message}`);
    process.exit(1);
  }
  const dur = durationOf(wav);
  total += dur;
  const words = wantWords ? transcribeWords(wav, line.text) : [];
  if (words.length > 0) wordsFilled += 1;
  voices.push({ path: `audio/${name}`, duration_s: dur, frame: line.frame, text: line.text, words });
  const tag = wantWords ? (words.length > 0 ? `${words.length}단어` : '단어 없음') : '스킵';
  console.log(`  ${String(line.n).padStart(2)}. ${dur.toFixed(2)}s  [${tag}]  ${line.text.slice(0, 42)}`);
}

writeFileSync(metaPath, JSON.stringify({ voices, total_duration_s: total, sfx: [], bgm: null }, null, 2) + '\n');

console.log(`\n✔ ${voices.length}개 / 총 ${total.toFixed(2)}초`);
if (wantWords) console.log(`  words[] 확보: ${wordsFilled}/${voices.length}줄 (whisper, --model ${whisperModel})`);
console.log(`  ${metaPath}`);
console.log(`\n다음: node check-script.mjs --project ${args.project ?? '.'}  (실측 반영 재검사)`);
