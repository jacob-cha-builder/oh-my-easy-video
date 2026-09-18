// 프로젝트 진행상태 판별. 의존성 0.
// check-script.mjs(훅)와 ko-status.mjs(독립 명령) 양쪽이 이 모듈을 공유한다.
// 라우트(faceless-explainer/slideshow/...)의 스텝 번호를 가정하지 않는다 — 산출물 존재로만 판단한다.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ktts = (dir) => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project ${dir}`;
const kcheck = (dir) => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project ${dir}`;
const kcues = (dir) => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/cues.mjs" --project ${dir}`;
const kcaptions = (dir) => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/check-captions.mjs" --project ${dir}`;

/**
 * review-loop.md §2 초안 패스를 건너뛰었는지 본다.
 * 프레임은 선언돼 있는데 전부 `status: outline` 이고 컴포지션 파일이 하나도 없으면
 * 아직 와이어프레임조차 안 올린 상태다 — 여기서 바로 애니메이션을 만들면 안 된다.
 * @returns {{ state: string, nextAction: string, nextCommand: string|null }|null}
 */
const sketchState = (dir, storyboardPath) => {
  let statuses = [];
  try {
    statuses = [...readFileSync(storyboardPath, 'utf8').matchAll(/^\s*-\s*status:\s*(\w+)/gm)].map(
      (m) => m[1],
    );
  } catch {
    return null;
  }
  if (statuses.length === 0) return null; // 프레임 선언 전 — 아직 plan 패스다
  if (statuses.some((s) => s !== 'outline')) return null; // 이미 진행된 프레임이 있다

  const framesDir = join(dir, 'compositions', 'frames');
  const built =
    existsSync(framesDir) && readdirSync(framesDir).some((f) => f.endsWith('.html'));
  if (built) return null;

  return {
    state: 'sketch-pending',
    nextAction:
      `프레임 ${statuses.length}개가 전부 outline 이고 컴포지션 파일이 없습니다 — ` +
      '리뷰 루프 §2(초안) 패스부터 하세요. 프레임마다 와이어프레임(진짜 문구 + 판때기, 모션 없음)을 ' +
      '올리고 status 를 built 로 바꾼 뒤 보드에서 레이아웃을 확정받으세요. ' +
      '여기서 완성 애니메이션을 만들지 마세요',
    nextCommand: 'npx hyperframes preview --background',
  };
};

/** @returns {{ state: string, nextAction: string, nextCommand: string|null }} */
export const detectStatus = (dir) => {
  const briefPath = join(dir, 'BRIEF.md');
  const storyboardPath = join(dir, 'STORYBOARD.md');
  const scriptPath = join(dir, 'SCRIPT.md');
  const metaPath = join(dir, 'audio_meta.json');
  const rendersDir = join(dir, 'renders');

  // 인터뷰를 건너뛴 진행을 막는다. BRIEF.md 는 /hyperframes 인터뷰의 산출물이고,
  // 그게 없으면 run-shape(collaborative/storyboard)도 정해지지 않아 리뷰 루프가 아예 안 켜진다.
  if (!existsSync(briefPath)) {
    return {
      state: 'no-brief',
      nextAction:
        'BRIEF.md 가 없습니다 — /hyperframes 인터뷰를 건너뛴 상태입니다. ' +
        'Skill(hyperframes) 를 먼저 부르세요. storyboard 질문에는 yes 로 답하고(4패스 리뷰 루프 스위치), ' +
        'flow 는 사용자가 답하게 두세요 — companion 은 /general-video 로 고정되어 라우팅이 죽습니다',
      nextCommand: null,
    };
  }

  if (!existsSync(storyboardPath)) {
    return {
      state: 'no-storyboard',
      nextAction: '/hyperframes 리뷰 루프 §1(plan) — 프레임 표를 제안하고 보드에서 승인받으세요',
      nextCommand: null,
    };
  }

  // 초안(sketch) 패스를 건너뛰고 완성 애니메이션으로 직행하는 걸 막는다.
  // review-loop.md §2: 프레임마다 와이어프레임을 먼저 올리고 status 를 built 로 바꾼다.
  const sketch = sketchState(dir, storyboardPath);
  if (sketch) return sketch;

  if (!existsSync(scriptPath)) {
    return {
      state: 'no-script',
      nextAction: '나레이션이 있다면 SCRIPT.md 를 쓰세요. 비주얼 전용 프로젝트면 이 플러그인은 관여하지 않습니다',
      nextCommand: null,
    };
  }

  if (!existsSync(metaPath)) {
    return {
      state: 'no-audio',
      nextAction: 'check-script.mjs 로 사전검사 통과 확인 후 ko-tts.mjs 실행',
      nextCommand: `${kcheck(dir)}\n${ktts(dir)}`,
    };
  }

  let meta = null;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch {
    meta = null;
  }
  const voices = meta?.voices ?? [];
  const missingWords = voices.filter((v) => !Array.isArray(v.words) || v.words.length === 0);

  if (voices.length > 0 && missingWords.length > 0) {
    return {
      state: 'missing-words',
      nextAction:
        `캡션/자막을 쓸 계획이면 ko-tts.mjs 를 재실행하세요 (자동으로 whisper 단어 타임스탬프 포함). ` +
        `안 쓰면 무시 가능 — ${missingWords.length}/${voices.length}줄에 words[] 없음`,
      nextCommand: ktts(dir),
    };
  }

  const rendered =
    existsSync(rendersDir) && readdirSync(rendersDir).some((f) => f.endsWith('.mp4'));

  if (!rendered) {
    // 오디오·단어 타임스탬프가 갖춰졌으면 다음은 비주얼이다. 여기서 큐시트를 안내해야
    // 에이전트가 audio_meta.json 을 눈으로 읽고 숫자를 손으로 옮기는 짓을 하지 않는다.
    return {
      state: 'ready-to-render',
      nextAction:
        '실측 재검사 → 큐시트로 나레이션 시각 확인 → 비주얼 빌드. ' +
        '빌드 후에는 cues.mjs --check 로 리빌이 단어에 맞았는지, ' +
        'check-captions.mjs 로 자막이 문장 단위인지 검증하세요',
      nextCommand: `${kcheck(dir)}\n${kcues(dir)}\n${kcaptions(dir)}`,
    };
  }

  return {
    state: 'rendered',
    nextAction: '렌더 완료 — 콘택트시트로 육안 확인했는지 확인하세요 (npx hyperframes snapshot)',
    nextCommand: null,
  };
};

/** check-script.mjs 출력 끝에 붙이는 한 줄 */
export const fmtNextAction = (status) =>
  `\n▶ 다음 단계: ${status.nextAction}` + (status.nextCommand ? `\n  ${status.nextCommand.split('\n').join('\n  ')}` : '');

// ── CLI ──────────────────────────────────────────────────────────────────────
// 직접 실행했을 때만 돈다. check-script.mjs 가 import 할 때는 아무것도 안 한다.
//   node status.mjs --project <dir>
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    args[process.argv[i]?.replace(/^--/, '')] = process.argv[i + 1];
  }
  const status = detectStatus(resolve(args.project ?? '.'));
  console.log(`상태: ${status.state}`);
  console.log(`▶ ${status.nextAction}`);
  if (status.nextCommand) {
    console.log('');
    for (const line of status.nextCommand.split('\n')) console.log(`  ${line}`);
  }
}
