# 한국어 자막 — 문장 단위 정적 자막

상류 캡션 프리셋은 **영어 쇼츠 문법**이다: 씬 단위로 잘게 쪼갠 그룹 + 단어마다 이동하는
하이라이트. 짧은 영어 자막에는 맞지만, 한국어 문장을 **읽어야 하는** 영상(보고자료·사내
공유·설명영상)에서는 문장이 조각나 읽히지 않는다.

게이트가 잡는다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-captions.mjs" --project <dir>
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-captions.mjs" --project <dir> --max-chars 24   # 세로형
```

## 실측 — 한 문장이 세 조각으로 (2026-09-18, `eli-github`)

`compositions/captions.html` 의 `GROUPS` 가 만든 화면:

```
group-0: "설명해주는 도구한테,"
group-1: "자기 자신을 설명해달라고"
group-2: "하면 어떻게 될까요?"
```

원래 한 문장이다 — *"설명해주는 도구한테, 자기 자신을 설명해달라고 하면 어떻게 될까요?"*
세 번에 나눠 뜨는 동안 시청자는 문장 전체를 한 번도 보지 못한다. 21개 그룹 중 **13개가
문장 중간에서 끊겼다.** 거기에 더해 각 단어에 코랄 밑줄이 옮겨다니고(`.is-active`),
단어마다 `scale: 0.98 → 1` 팝이 붙는다.

`korean-typography.md` 의 `word-break` 문제와 같은 계열이다 — **라틴어 가정을 한글에 그대로
적용하면 깨진다.** 다른 점: 이건 `lint` 도 `check` 도 잡지 못했다.

## 스펙

| 항목 | 값 | 이유 |
|---|---|---|
| 그룹 경계 | 문장 종결(`.` `?` `!` / 종결어미) | 쉼표로 자르면 문장이 조각난다 |
| 한 화면 글자 수 | 16:9 = 40자 · 9:16 = 24자 | `korean-narration.md` 카피 예산의 자막판 |
| 단어 단위 상태 | **없음** | 색이 이동하면 읽는 위치가 아니라 색을 보게 된다 |
| 등장/퇴장 | `opacity` 만, 0.25s `power1.out` | 위치·크기가 변하면 글자를 다시 찾아야 한다 |
| 줄바꿈 | `word-break: keep-all` | `korean-typography.md` 규칙 2 |

## 고치는 법 — `caption-skin.html` 두 곳

**1. 단어 상태 분기 제거.** `.is-active` / `.is-spoken` 이 기본 상태와 다른 색·밑줄을
칠하지 않게 한다. 셋 다 같은 값이면 게이트를 통과한다.

```css
/* before — 말하는 단어만 진해지고 밑줄이 따라다닌다 */
.caption-word          { color: color-mix(in srgb, var(--cap-ink) 40%, var(--cap-canvas)); }
.caption-word.is-active { color: var(--cap-ink); border-bottom: 3px solid var(--cap-accent); }

/* after — 문장 전체가 같은 잉크, 밑줄 없음 */
.caption-word,
.caption-word.is-active,
.caption-word.is-spoken { color: var(--cap-ink); border-bottom: 3px solid transparent; }
```

`.is-active` / `.is-spoken` 클래스 자체는 **지우지 않는다.** 타임라인이 `gsap.set({className})`
으로 계속 붙이므로, 클래스는 남기고 시각 차이만 없앤다.

**2. 단어 팝 트윈 제거.** 타임라인에서 이 줄을 지운다:

```js
tl.fromTo(el, { scale: 0.98 }, { scale: 1, duration: 0.16, ease: "power1.out" }, at);
```

그룹 on/off(`tl.set(groupEl, { opacity: … })`)만 남긴다.

## GROUPS 를 문장 단위로 병합하기

새로 측정할 것이 없다. `audio_meta.json` 의 `voices[].text` 가 **이미 문장 단위**이고,
같은 파일의 `words[]` 에 단어별 시각이 있다. 문장 하나 = 그룹 하나로 만들 때:

- `start` = 그 문장 첫 단어의 `start`
- `end` = 그 문장 마지막 단어의 `end`
- `text` = `voices[].text` 그대로
- `words` = 그 문장의 `words[]` 그대로 (지워도 되지만, 남겨두면 나중에 되돌리기 쉽다)

한 문장이 40자를 넘으면 그때만 쉼표에서 두 그룹으로 나눈다 — 기본은 나누지 않는 것이다.

## 게이트 규칙

| # | 규칙 | 판정 |
|---|---|---|
| 1 | `.is-active`/`.is-spoken` 이 기본과 다른 색·밑줄을 칠하지 않음 | 실패 |
| 2 | 캡션 단어에 `scale` 트윈이 없음 | 실패 |
| 3 | 그룹이 문장 중간에서 끊기지 않음 (다음 그룹이 같은 프레임일 때) | 실패 |
| 4 | 한 그룹 글자 수 ≤ `--max-chars` | 경고 |

규칙 3의 문장 종결 판정은 종결부호 + 흔한 종결어미(`다` `요` `죠` `까` `습니다` …)
화이트리스트다. 구어체에서 오탐이 나오면 `check-captions.mjs` 의 `ENDINGS` 에 추가하고
**여기에 사례를 남겨라.**

## 함께 볼 것

- `korean-report-motion.md` — 자막의 정적 처리는 모션 규율의 일부다. 자막만 고치고 배경이
  계속 돌면 효과가 반감된다.
- `korean-typography.md` — `@font-face` 선언과 `word-break: keep-all`
- `korean-narration.md` — 화면 카피 예산(자막 글자 수 상한의 근거)
