#!/usr/bin/env node
// 한국어 나레이션 생성기 (MeloTTS 엔진) — SCRIPT.md → wav + audio_meta.json
//
// ko-tts.mjs 와 같은 계약을 지킨다: 같은 입력(SCRIPT.md)을 읽고, 같은 형식의
// audio_meta.json({ voices: [{path, duration_s, frame, text, words}], total_duration_s, sfx, bgm })
// 을 만든다 — check-script.mjs / cues.mjs / animation-map.mjs 등 하류는 이 스크립트가
// 대신 만들어도 그대로 돈다. 다른 건 합성 엔진뿐이다: Piper 대신 MeloTTS(다국어, MIT
// 라이선스 — Piper 의 ko_KR-kss-medium 은 CC BY-NC-SA 4.0 이라 상업적 용도로 못 쓴다).
//
// 사용:
//   node melo-tts.mjs --project videos/<name> [--speed 1.2] [--whisper-model small] [--no-words]
//
// 필요한 것 (setup.mjs --engine melo 가 설치한다):
//   ~/.cache/oh-my-easy-video/venv-melo — MeloTTS 전용 파이썬 venv
//   ffprobe — 길이 측정
//
// 왜 별도 venv 인가:
//   MeloTTS 는 import 시점에 모든 언어 백엔드를 무조건 불러온다
//   (melo/text/cleaner.py: `from . import chinese, japanese, ...`), 그리고 일본어 모듈은
//   MeCab.Tagger() 를 모듈 최상단에서 생성한다. 즉 한국어만 쓰더라도 일본어 MeCab
//   바인딩(mecab-python3)이 import 가능해야 한다. 그런데 macOS/Windows 의 대소문자
//   구분 없는 파일시스템에서는 mecab-python3 가 설치하는 `MeCab/` 과 python-mecab-ko
//   (실제 한국어 형태소 분석에 필요)가 설치하는 `mecab/` 이 같은 디렉터리로 병합되어
//   서로의 파일을 덮어쓴다 — 아무 조합으로 설치해도 한쪽이 깨진다.
//   setup.mjs 는 mecab-python3 를 아예 제거하고 melo/text/japanese.py 의
//   `import MeCab` 을 선택적으로 만드는 패치를 적용해 이 충돌을 피한다(한국어 전용
//   설치이므로 일본어 백엔드가 실제로 동작할 필요는 없다 — import 만 통과하면 된다).

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const rawArgv = process.argv.slice(2);
const wantWords = !rawArgv.includes('--no-words');
const argv = rawArgv.filter((a) => a !== '--no-words');

const args = {};
for (let i = 0; i < argv.length; i += 2) {
  args[argv[i]?.replace(/^--/, '')] = argv[i + 1];
}

const projectDir = resolve(args.project ?? '.');
const metaPath = join(projectDir, 'audio_meta.json');
const scriptDir = dirname(fileURLToPath(import.meta.url));

const CACHE = join(homedir(), '.cache', 'oh-my-easy-video');
const melodyPy = args['melo-python'] ?? process.env.MELO_PYTHON ?? join(CACHE, 'venv-melo', 'bin', 'python');
const SETUP_HINT = `  설치: node "\${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" --engine melo`;

if (!existsSync(scriptDir + '/melo_synth.py')) {
  console.error(`[FATAL] melo_synth.py 를 찾을 수 없습니다 (${scriptDir}).`);
  process.exit(2);
}

if (!existsSync(melodyPy)) {
  console.error(`[FATAL] MeloTTS venv 를 찾을 수 없습니다: ${melodyPy}\n${SETUP_HINT}\n` +
    `  또는 직접 지정: --melo-python <실행파일> / MELO_PYTHON=<venv>/bin/python`);
  process.exit(2);
}

// 기본 1.2 — MeloTTS 의 1.0 은 4.61음절/초로 느려서(실측) 답답하게 들리고,
// narration.mjs 의 추정 상수(5.5음절/초, Piper 기준)와도 18~20% 어긋난다.
// 1.2 는 5.32음절/초로 귀에도 낫고 추정 오차도 같이 줄인다 — korean-narration.md 참고.
const speed = args.speed ?? '1.2';

console.log('▶ MeloTTS 로 합성 중 (모델 로드에 시간이 걸립니다)...\n');
let synthOut;
try {
  synthOut = execFileSync(melodyPy, [join(scriptDir, 'melo_synth.py'), '--project', projectDir, '--speed', speed], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
} catch (e) {
  console.error(`\n✘ MeloTTS 합성 실패: ${e.message}`);
  process.exit(1);
}

let lines;
try {
  lines = JSON.parse(synthOut.trim().split('\n').pop()).lines;
} catch {
  console.error('[FATAL] melo_synth.py 출력에서 결과 JSON 을 읽지 못했습니다.');
  process.exit(1);
}

const durationOf = (wav) =>
  Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=nk=1:nw=1', wav], { encoding: 'utf8' }).trim(),
  );

const whisperModel = args['whisper-model'] ?? 'small';

// whisper 는 타임스탬프만 신뢰한다 — 받아쓴 텍스트는 오독이 섞인다. 토큰 수가 원문의
// 공백 분리 어절 수와 같으면 원문 어절로 텍스트를 덮어쓴다(ko-tts.mjs 와 동일한 휴리스틱).
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
    unlinkSync(transcriptPath);
  }
};

const voices = [];
let total = 0;
let wordsFilled = 0;

for (const line of lines) {
  const wav = join(projectDir, line.path);
  const dur = durationOf(wav);
  total += dur;
  const words = wantWords ? transcribeWords(wav, line.text) : [];
  if (words.length > 0) wordsFilled += 1;
  voices.push({ path: line.path, duration_s: dur, frame: line.frame, text: line.text, words });
  const tag = wantWords ? (words.length > 0 ? `${words.length}단어` : '단어 없음') : '스킵';
  console.log(`  ${String(line.n).padStart(2)}. ${dur.toFixed(2)}s  [${tag}]  ${line.text.slice(0, 42)}`);
}

// audio.mjs 의 fetch-sfx (하류 워크플로의 정상 Step 5 SFX 패스)가 이 audio_meta.json 에
// sfx/bgm 을 자기 사이드카에서 덮어쓸 수 있다 — 이미 있으면 보존한다.
let existingSfx = [];
let existingBgm = null;
if (existsSync(metaPath)) {
  try {
    const prev = JSON.parse(readFileSync(metaPath, 'utf8'));
    existingSfx = Array.isArray(prev.sfx) ? prev.sfx : [];
    existingBgm = prev.bgm ?? null;
  } catch {}
}

writeFileSync(metaPath, JSON.stringify({ voices, total_duration_s: total, sfx: existingSfx, bgm: existingBgm }, null, 2) + '\n');

console.log(`\n✔ ${voices.length}개 / 총 ${total.toFixed(2)}초`);
if (wantWords) console.log(`  words[] 확보: ${wordsFilled}/${voices.length}줄 (whisper, --model ${whisperModel})`);
console.log(`  ${metaPath}`);
console.log(`\n⚠ MeloTTS 는 narration.mjs 의 5.5음절/초 상수(Piper 기준)보다 느리게 읽는다 ` +
  `(실측: 평균 18~20% 과소추정 — korean-narration.md 참고). 추정만 믿지 말고 반드시` +
  ` 재검사하라:\n다음: node check-script.mjs --project ${args.project ?? '.'}  (실측 반영 재검사)`);
