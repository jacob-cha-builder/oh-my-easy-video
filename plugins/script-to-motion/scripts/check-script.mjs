#!/usr/bin/env node
// 한국어 나레이션 게이트 — 상류 산출물(SCRIPT.md / STORYBOARD.md / audio_meta.json)을 읽는다.
// 의존성 0. 우리 포맷을 강요하지 않는다.
//
// 사용: node check-script.mjs --project videos/<name>
// 종료코드: 0 = 통과, 1 = 위반, 2 = 파일 없음
//
// Step 3(대본) 직후, Step 3.1(오디오) 진입 전에 돌린다.
// 오디오 생성 후 다시 돌리면 실측(audio_meta.json)으로 재검사한다.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { estimateSec, suggestDuration, fmtDuration, PAD } from './narration.mjs';
import { parseScript, parseStoryboard } from './parse-plan.mjs';
import { detectStatus, fmtNextAction } from './status.mjs';

const RULES = {
  1: '나레이션이 씬 길이에 들어감',
  2: '정적 과다',
  3: '씬 합계 == 목표 길이',
  4: '한국어 조사 처리',
  5: '추정 vs 실측 오차',
  6: '캡션 동기화용 단어 타임스탬프 존재',
};

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]?.replace(/^--/, '')] = process.argv[i + 1];

const dir = resolve(args.project ?? '.');
const scriptPath = join(dir, 'SCRIPT.md');
const boardPath = join(dir, 'STORYBOARD.md');
const metaPath = join(dir, 'audio_meta.json');

if (!existsSync(boardPath)) {
  console.error(`[FATAL] ${boardPath} 가 없습니다. Step 3 을 먼저 끝내세요.`);
  process.exit(2);
}

const board = parseStoryboard(readFileSync(boardPath, 'utf8'));
const script = existsSync(scriptPath) ? parseScript(readFileSync(scriptPath, 'utf8')) : [];
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : null;

if (script.length === 0) {
  console.log('나레이션 없는 프로젝트입니다 (SCRIPT.md 없음). 한국어 게이트는 건너뜁니다.');
  process.exit(0);
}

const errors = [];
const warns = [];
const fail = (rule, where, msg) => errors.push({ rule, where, msg });
const warn = (rule, where, msg) => warns.push({ rule, where, msg });

/** 프레임 번호로 씬 길이를 찾는다. 없으면 SCRIPT.md 의 Time 창을 쓴다. */
const durationFor = (line) => {
  const f = board.frames.find((x) => x.n === line.frame);
  if (f?.duration != null) return { sec: f.duration, src: 'STORYBOARD frame' };
  if (line.timeStart != null && line.timeEnd != null) {
    return { sec: line.timeEnd - line.timeStart, src: 'SCRIPT Time' };
  }
  return null;
};

/** audio_meta.json 에서 이 줄에 대응하는 voice 항목 */
const voiceFor = (line) => {
  if (!meta?.voices) return null;
  return meta.voices.find((x) => x.frame === line.frame) ?? meta.voices[line.n - 1] ?? null;
};

/** audio_meta.json 의 실측 길이 */
const measuredFor = (line) => {
  const v = voiceFor(line);
  return typeof v?.duration_s === 'number' ? v.duration_s : null;
};

const fps = 30; // 프레임 정렬 제안용. HyperFrames 는 초 단위라 표시 목적만.
let sumSpoken = 0;
let sumDur = 0;
const deltas = [];

for (const line of script) {
  const at = `Line ${line.n}${line.frame ? ` (Frame ${line.frame})` : ''}`;
  const d = durationFor(line);
  const measured = measuredFor(line);
  const spoken = measured ?? estimateSec(line.text);
  const src = measured != null ? '실측' : '추정';
  sumSpoken += spoken;

  if (measured != null) deltas.push({ n: line.n, est: estimateSec(line.text), act: measured });

  if (!d) {
    warn(1, at, '씬 길이를 알 수 없습니다 (STORYBOARD 에 duration 도, SCRIPT 에 Time 도 없음)');
    continue;
  }
  sumDur += d.sec;
  const slack = d.sec - spoken;

  // ── 규칙 1: 나레이션이 들어가는가 ──
  if (slack < PAD.min - 1e-6) {
    const need = suggestDuration(line.text, fps);
    fail(1, at,
      `나레이션 ${src} ${spoken.toFixed(2)}초 / 씬 ${d.sec}초 (${d.src}) — 여백 ${slack.toFixed(2)}초, ` +
      `최소 ${PAD.min}초 필요. 씬을 ${fmtDuration(need)} 이상으로 늘리거나 나레이션을 줄이세요`);
  }
  // ── 규칙 2: 정적 과다 ──
  else if (slack > PAD.max + 1e-6) {
    fail(2, at,
      `나레이션 ${src} ${spoken.toFixed(2)}초 / 씬 ${d.sec}초 — ${slack.toFixed(2)}초가 빕니다 ` +
      `(최대 ${PAD.max}초). 말이 끝난 뒤 정적이 흐릅니다`);
  }

  // ── 규칙 6: 캡션 동기화용 단어 타임스탬프 ──
  // 캡션 없이 가는 프로젝트도 유효하므로 경고만 한다 (차단 안 함).
  if (meta) {
    const v = voiceFor(line);
    if (v && (!Array.isArray(v.words) || v.words.length === 0)) {
      warn(6, at, '단어 타임스탬프(words[])가 없습니다. 캡션/화면 싱크가 필요하면 ' +
        'ko-tts.mjs 를 재실행하세요(자동으로 whisper 포함). 캡션 안 쓰면 무시하세요');
    }
  }

  // ── 규칙 4: 조사 처리 ──
  // 화면 카피(storyboard scene/title)가 나레이션의 부분 문자열인데 조사 앞에서 잘렸는지 본다.
  const frame = board.frames.find((x) => x.n === line.frame);
  const copy = frame?.raw?.emphasis ?? frame?.raw?.copy;
  if (copy && line.text.includes(copy)) {
    const after = line.text.slice(line.text.indexOf(copy) + copy.length).trim();
    // \b 는 [A-Za-z0-9_] 기준이라 한글 뒤에서 경계로 잡히지 않는다.
    // "은행" 처럼 조사가 아니라 단어의 첫 글자인 경우를 배제하려면 뒤에 한글이 안 오는지 본다.
    const PARTICLE = /^(으로|까지|부터|에서|을|를|이|가|은|는|에|의|와|과|로|도|만)(?![가-힣])/;
    const m = after.match(PARTICLE);
    if (m) {
      const particle = m[1];
      fail(4, at,
        `강조 "${copy}" 뒤가 조사 "${particle}" 로 시작합니다. 조사를 강조에 포함시키세요 ` +
        `→ "${copy}${particle}"  (references/korean-narration.md)`);
    }
  }
}

// ── 규칙 3: 합계 ──
if (board.totalSec != null && sumDur > 0) {
  const diff = sumDur - board.totalSec;
  if (Math.abs(diff) > 0.5) {
    warn(3, 'STORYBOARD frontmatter',
      `프레임 duration 합계 ${sumDur.toFixed(1)}초 vs 목표 ${board.totalSec}초 ` +
      `(${diff > 0 ? '+' : ''}${diff.toFixed(1)}초). 상류는 duration 을 advisory 로 두므로 경고만 합니다`);
  }
}

// ── 규칙 5: 추정 vs 실측 오차 리포트 (상수 보정 근거) ──
if (deltas.length > 0) {
  const rel = deltas.map((d) => Math.abs(d.est - d.act) / d.act);
  const mean = (rel.reduce((a, b) => a + b, 0) / rel.length) * 100;
  const worst = deltas[rel.indexOf(Math.max(...rel))];
  const worstPct = Math.max(...rel) * 100;
  if (mean > 10) {
    warn(5, 'narration.mjs', `추정 평균오차 ${mean.toFixed(1)}% — 상수를 보정하세요 (5.5음절/초)`);
  }
  console.log(`추정 대비 실측: 평균오차 ${mean.toFixed(1)}% · 최악 Line ${worst.n} ${worstPct.toFixed(1)}%`);
}

// ── 출력 ─────────────────────────────────────────────────────────────────────
const fmt = (list, mark) => {
  const by = new Map();
  for (const e of list) (by.get(e.rule) ?? by.set(e.rule, []).get(e.rule)).push(e);
  for (const r of [...by.keys()].sort((a, b) => a - b)) {
    console.error(`  ${mark} [규칙 ${r}] ${RULES[r]}`);
    for (const e of by.get(r)) console.error(`      · ${e.where}: ${e.msg}`);
  }
};

if (errors.length === 0) {
  console.log(`✔ 한국어 나레이션 검사 통과 — ${script.length}줄 / 발화 ${sumSpoken.toFixed(1)}초` +
    (meta ? ' (실측)' : ' (추정 — 오디오 생성 후 재검사하세요)'));
}

if (warns.length > 0) {
  console.error(`\n⚠ 경고 ${warns.length}건`);
  fmt(warns, '⚠');
}
if (errors.length > 0) {
  console.error(`\n✘ 한국어 나레이션 검사 실패 — ${errors.length}건\n`);
  fmt(errors, '✘');
  console.error(`\n대본을 고치기 전에는 오디오 생성(Step 3.1)으로 넘어가지 마세요.`);
}

const status = detectStatus(dir);
console.error(fmtNextAction(status));

process.exit(errors.length > 0 ? 1 : 0);
