#!/usr/bin/env node
// 한국어 자막 게이트 — 캡션 컴포지션이 "보고자료 톤"인지 검사한다.
// 의존성 0. 상류가 만든 captions.html 을 그대로 읽는다.
//
// 사용: node check-captions.mjs --project videos/<name>
// 종료코드: 0 = 통과, 1 = 위반, 2 = 검사 대상 없음
//
// 캡션을 붙인 뒤(빌드 패스) 렌더 전에 돌린다.
// 규칙의 근거는 references/korean-captions.md.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RULES = {
  1: '단어 단위 카라오케 없음',
  2: '단어 팝(scale) 없음',
  3: '자막이 문장 단위로 끊김',
  4: '한 화면 글자 수',
};

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]?.replace(/^--/, '')] = process.argv[i + 1];

const dir = resolve(args.project ?? '.');
// 16:9 기준 2줄. 세로형은 --max-chars 로 낮춘다 (korean-narration.md 카피 예산).
const MAX_CHARS = Number(args['max-chars'] ?? 40);

/** captions 컴포지션을 찾는다 — 상류가 compositions/captions.html 로 쓴다. */
const findCaptionFiles = () => {
  const out = [];
  for (const sub of ['compositions', '.hyperframes']) {
    const d = join(dir, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (!f.endsWith('.html')) continue;
      const p = join(d, f);
      const src = readFileSync(p, 'utf8');
      if (src.includes('caption-word') || src.includes('data-composition-id="captions"')) {
        out.push({ path: `${sub}/${f}`, src });
      }
    }
  }
  return out;
};

const files = findCaptionFiles();
if (files.length === 0) {
  console.log('캡션 컴포지션이 없습니다 (자막 없는 프로젝트). 자막 게이트는 건너뜁니다.');
  process.exit(0);
}

const errors = [];
const warns = [];
const fail = (rule, where, msg) => errors.push({ rule, where, msg });
const warn = (rule, where, msg) => warns.push({ rule, where, msg });

/** CSS 블록 하나를 셀렉터로 뽑는다 (주석은 미리 제거한 소스를 넘긴다). */
const ruleBody = (css, selector) => {
  const i = css.indexOf(selector);
  if (i === -1) return null;
  const open = css.indexOf('{', i);
  const close = css.indexOf('}', open);
  if (open === -1 || close === -1) return null;
  return css.slice(open + 1, close);
};

/** 선언값이 "실제로 무언가를 칠하는가" — `3px solid transparent` 처럼 색이 투명하면 꺼진 것이다. */
const isLive = (decl) => decl != null && !/\b(transparent|none|inherit|initial|unset)\b/i.test(decl);

const declOf = (body, prop) => {
  const m = body?.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : null;
};

/** 문장 종결 판정 — 종결부호 또는 흔한 한국어 종결어미. 오탐이 나오면 여기에 추가한다. */
const ENDINGS = /(?:[.!?…]|다|요|죠|까|군요|네요|습니다|입니다|겠죠|보세요)\s*["'”’)\]]?\s*$/;
const endsSentence = (t) => ENDINGS.test(String(t ?? '').trim());

for (const { path, src } of files) {
  // 주석 안의 예시 코드가 오탐을 만들지 않도록 먼저 지운다.
  const code = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // ── 규칙 1: 단어 단위 카라오케 ──────────────────────────────────────────
  // .is-active / .is-spoken 이 .caption-word 와 다른 색·밑줄을 칠하면 글자마다 상태가 이동한다.
  const base = ruleBody(code, '.caption-word');
  const baseColor = declOf(base, 'color');
  for (const state of ['.caption-word.is-active', '.caption-word.is-spoken']) {
    const body = ruleBody(code, state);
    if (body == null) continue;
    const color = declOf(body, 'color');
    const border = declOf(body, 'border-bottom');
    if (color != null && color !== baseColor) {
      fail(1, `${path} ${state}`, `color 가 기본 상태와 다름 (${color}) — 말하는 단어만 색이 바뀝니다`);
    }
    if (isLive(border)) {
      fail(1, `${path} ${state}`, `border-bottom 이 살아있음 (${border}) — 밑줄이 단어를 따라 이동합니다`);
    }
  }

  // ── 규칙 2: 단어 팝 ────────────────────────────────────────────────────
  // 캡션 단어에 걸린 scale 트윈. 0.98→1 도 누적되면 "반짝이는" 인상을 만든다.
  for (const m of code.matchAll(/\b(?:fromTo|from|to)\s*\(\s*([^)]{0,200}?)\)/g)) {
    const call = m[1];
    if (!/caption/i.test(call) && !/\bel\b/.test(call)) continue;
    if (/\bscale\s*:/.test(call)) {
      fail(2, path, 'caption 단어에 scale 트윈이 걸려 있습니다 — 그룹 opacity 만 남기세요');
      break;
    }
  }

  // ── 규칙 3·4: GROUPS 내용 ──────────────────────────────────────────────
  const gm = code.match(/var\s+GROUPS\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!gm) {
    warn(3, path, 'GROUPS 배열을 찾지 못했습니다 — 문장 단위 검사를 건너뜁니다');
    continue;
  }

  let groups;
  try {
    groups = JSON.parse(gm[1]);
  } catch {
    warn(3, path, 'GROUPS 를 JSON 으로 읽지 못했습니다 — 문장 단위 검사를 건너뜁니다');
    continue;
  }

  groups.forEach((g, i) => {
    const text = String(g.text ?? '');
    const next = groups[i + 1];

    // 다음 그룹이 같은 프레임에 있는데 이 그룹이 문장 중간에서 끊겼다 = 한 문장을 쪼갬.
    if (!endsSentence(text) && next && next.frame === g.frame) {
      fail(3, `${path} group-${i}`, `문장 중간에서 끊김: "${text}" → 다음 그룹과 합치세요`);
    }

    if (text.length > MAX_CHARS) {
      warn(4, `${path} group-${i}`, `${text.length}자 (상한 ${MAX_CHARS}) — 문장을 나누세요: "${text.slice(0, 24)}…"`);
    }
  });
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
  console.log(`✔ 자막 검사 통과 — ${files.length}개 컴포지션 (${files.map((f) => f.path).join(', ')})`);
}
if (warns.length > 0) {
  console.error(`\n⚠ 경고 ${warns.length}건`);
  fmt(warns, '⚠');
}
if (errors.length > 0) {
  console.error(`\n✘ 자막 검사 실패 — ${errors.length}건\n`);
  fmt(errors, '✘');
  console.error(`\n고치는 법: references/korean-captions.md`);
}

process.exit(errors.length > 0 ? 1 : 0);
