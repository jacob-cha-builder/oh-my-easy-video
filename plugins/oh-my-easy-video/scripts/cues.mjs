#!/usr/bin/env node
// 나레이션 큐시트 — "이 단어가 나올 때 이걸 띄운다" 를 추측 없이 만들기 위한 도구.
//
//   node cues.mjs --project <dir>             전체 프레임 큐시트
//   node cues.mjs --project <dir> --frame 3   한 프레임만
//   node cues.mjs --project <dir> --check     애니메이션과 교차검증 (드리프트 탐지)
//
// --check 는 상류 animation-map 이 먼저 있어야 한다:
//   node ~/.claude/skills/hyperframes-animation/scripts/animation-map.mjs <dir> \
//     --out <dir>/.hyperframes/anim-map
//
// 왜 필요한가: 화면 리빌 타이밍이 단어 타임스탬프에 의존하는데(상류
// "the agent gets word timings for free"), 지금은 에이전트가 audio_meta.json 을 눈으로 읽고
// 숫자를 손으로 옮겨 적는다. 오디오를 다시 만들면 그 숫자가 전부 조용히 어긋난다.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseStoryboard } from './parse-plan.mjs';

const args = {};
const flags = new Set();
for (const a of process.argv.slice(2)) {
  if (a === '--check') flags.add('check');
}
const argv = process.argv.slice(2).filter((a) => a !== '--check');
for (let i = 0; i < argv.length; i += 2) args[argv[i]?.replace(/^--/, '')] = argv[i + 1];

const dir = resolve(args.project ?? '.');
const metaPath = join(dir, 'audio_meta.json');
const boardPath = join(dir, 'STORYBOARD.md');

if (!existsSync(metaPath)) {
  console.error(`[FATAL] ${metaPath} 가 없습니다. 먼저 ko-tts.mjs 로 오디오를 만드세요.`);
  process.exit(2);
}

const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const board = existsSync(boardPath) ? parseStoryboard(readFileSync(boardPath, 'utf8')) : { frames: [] };
const voices = meta.voices ?? [];

// 프레임 시작 시각(절대) = 앞선 프레임 duration 의 누적합.
// 프레임 컴포지션 안에서는 로컬 시각을, 루트 index.html 에서는 절대 시각을 쓴다.
// 이 둘을 헷갈리는 게 흔한 실수라 양쪽 다 찍는다.
const starts = [];
let acc = 0;
for (const v of voices) {
  const f = board.frames.find((x) => x.n === v.frame);
  starts.push(acc);
  acc += f?.duration ?? v.duration_s ?? 0;
}

const only = args.frame ? Number(args.frame) : null;
const fmt = (n) => n.toFixed(2).padStart(6);

let missing = 0;
const rows = []; // --check 용: { frame, localStart, absStart, text }

console.log(`큐시트 — ${voices.length}개 프레임\n`);

voices.forEach((v, i) => {
  if (only != null && v.frame !== only) return;
  const base = starts[i];
  const words = Array.isArray(v.words) ? v.words : [];

  console.log(
    `Frame ${v.frame}  ·  절대 ${base.toFixed(2)}–${(base + (v.duration_s ?? 0)).toFixed(2)}s  ·  ${v.path}`,
  );

  if (words.length === 0) {
    missing++;
    console.log(`  ⚠ 단어 타임스탬프 없음 — ko-tts.mjs 를 --no-words 없이 다시 돌리세요\n`);
    return;
  }

  console.log(`     로컬    절대   단어`);
  for (const w of words) {
    console.log(`  ${fmt(w.start)} ${fmt(base + w.start)}   ${w.text}`);
    rows.push({ frame: v.frame, local: w.start, abs: base + w.start, text: w.text });
  }
  console.log('');
});

if (!flags.has('check')) {
  console.log('─'.repeat(60));
  console.log('프레임 컴포지션 안에서는 "로컬" 열의 숫자를 쓰세요 (타임라인이 0에서 시작).');
  console.log('루트 index.html 의 오디오 배치에는 "절대" 열을 쓰세요.');
  if (missing > 0) console.log(`\n⚠ ${missing}개 프레임에 단어 타임스탬프가 없습니다.`);
  process.exit(0);
}

// ── --check: 애니메이션과 교차검증 ───────────────────────────────────────────
const mapPath = join(dir, '.hyperframes', 'anim-map', 'animation-map.json');
if (!existsSync(mapPath)) {
  console.error(
    `[FATAL] ${mapPath} 가 없습니다. 먼저 애니메이션 맵을 만드세요:\n` +
      `  node ~/.claude/skills/hyperframes-animation/scripts/animation-map.mjs ${dir} \\\n` +
      `    --out ${dir}/.hyperframes/anim-map`,
  );
  process.exit(2);
}

const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const tweens = (map.tweens ?? []).filter((t) => t.driver !== 'onUpdate');

// 리빌은 단어 경계에 붙어야 한다. 멀리 떨어진 건 나레이션과 무관하게 도는 것이다.
const TOL = 0.4;
const drifted = [];

for (const tw of tweens) {
  const nearest = rows.reduce(
    (best, r) => {
      const d = Math.abs(r.abs - tw.start);
      return d < best.d ? { d, r } : best;
    },
    { d: Infinity, r: null },
  );
  if (nearest.d > TOL) drifted.push({ tw, nearest });
}

console.log('─'.repeat(60));
console.log(`교차검증 — 트윈 ${tweens.length}개 vs 단어 ${rows.length}개  (허용오차 ${TOL}초)\n`);

if (drifted.length === 0) {
  console.log('✔ 모든 트윈이 단어 경계 근처에서 시작합니다.');
} else {
  console.log(`⚠ ${drifted.length}개 트윈이 어느 단어와도 ${TOL}초 안에 맞지 않습니다:\n`);
  for (const { tw, nearest } of drifted) {
    const near = nearest.r ? `가장 가까운 단어 "${nearest.r.text}" @${nearest.r.abs.toFixed(2)}s (${nearest.d.toFixed(2)}초 차이)` : '대응 단어 없음';
    console.log(`  t=${tw.start.toFixed(2)}s  ${tw.selector}`);
    console.log(`      ${near}`);
  }
  console.log(`\n장식용 모션(배경·앰비언트)이면 정상입니다.`);
  console.log(`나레이션에 맞춰야 할 리빌이면 위 "절대" 시각으로 고치세요.`);
}
