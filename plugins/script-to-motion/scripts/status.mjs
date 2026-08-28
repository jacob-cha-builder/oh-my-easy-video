// 프로젝트 진행상태 판별. 의존성 0.
// check-script.mjs(훅)와 ko-status.mjs(독립 명령) 양쪽이 이 모듈을 공유한다.
// 라우트(faceless-explainer/slideshow/...)의 스텝 번호를 가정하지 않는다 — 산출물 존재로만 판단한다.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ktts = (dir) => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project ${dir}`;
const kcheck = (dir) => `node "\${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project ${dir}`;

/** @returns {{ state: string, nextAction: string, nextCommand: string|null }} */
export const detectStatus = (dir) => {
  const storyboardPath = join(dir, 'STORYBOARD.md');
  const scriptPath = join(dir, 'SCRIPT.md');
  const metaPath = join(dir, 'audio_meta.json');
  const rendersDir = join(dir, 'renders');

  if (!existsSync(storyboardPath)) {
    return {
      state: 'no-storyboard',
      nextAction: '/hyperframes 로 스토리보드부터 작성하세요 (이 플러그인은 그 다음부터 관여합니다)',
      nextCommand: null,
    };
  }

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
    return {
      state: 'ready-to-render',
      nextAction: 'check-script.mjs 로 실측 재검사 통과 확인 후 /hyperframes 로 Step 4(비주얼) 진행',
      nextCommand: kcheck(dir),
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
