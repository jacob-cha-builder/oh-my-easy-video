---
name: ko-video
description: 한국어 나레이션 영상의 대본 길이를 검사하고 한국어 TTS 를 생성한다. HyperFrames 로 한국어 영상을 만들 때 STORYBOARD.md / SCRIPT.md 를 쓴 뒤 오디오 단계 전에 사용. 발화 길이·조사·정적을 본다. 파이프라인 자체는 /hyperframes 가 소유한다.
---

# ko-video — HyperFrames 한국어 보조 레이어

**이 스킬은 파이프라인을 소유하지 않는다.** 인터뷰·라우팅·스토리보드·디자인·모션·렌더는
전부 `/hyperframes` 와 그 워크플로가 owner 다. 여기는 **한국어에서만 생기는 두 가지 구멍**을 메운다.

> 영상 제작 요청이 오면 **먼저 `/hyperframes` 를 읽어라.** 그게 라우팅을 결정한다.
> 이 스킬은 그 워크플로의 Step 3 과 3.1 사이에 끼어드는 보조 도구다.

## 왜 필요한가

1. **HyperFrames 의 TTS 에 한국어가 없다.** 번들된 Kokoro 는 9개 언어(미/영 영어, 일본어,
   중국어, 스페인·프랑스·힌디·이탈리아·포르투갈)뿐이고 한국어가 빠져 있다
   (`hexgrad/Kokoro-82M` 의 `VOICES.md` 기준). HeyGen 클라우드는 로그인이 필요하다.
2. **상류는 나레이션 길이를 추정하지 않고 측정한다.** `SCRIPT.md` 스펙이 `**Time:**` 을
   *"a guide, not authoritative"* 라고 못박고 실측은 Step 3.1 에서야 나온다. 영어권 작성자는
   wpm 감각으로 대본이 컷에 맞는지 짐작하지만 **한국어는 그 감각이 전이되지 않는다.**

## 언제 끼어드는가

```
/hyperframes → 워크플로 라우팅 → ... → Step 3 (STORYBOARD.md + SCRIPT.md)
                                              │
                                    ① check-script.mjs   ← 추정 기반 사전 검사
                                              │
                                        Step 3.1 오디오
                                    ② ko-tts.mjs         ← 한국어일 때 audio.mjs 대신
                                              │
                                    ③ check-script.mjs   ← 실측 기반 재검사
                                              │
                                        Step 4 이후 (상류 그대로)
```

### ① 대본 사전 검사 — 오디오 만들기 전

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project videos/<name>
```

`STORYBOARD.md` 의 프레임 `duration` 과 `SCRIPT.md` 의 발화 텍스트를 대조한다.
**exit 1 이면 Step 3.1 로 넘어가지 마라.** 대본을 고치는 게 오디오를 다시 만드는 것보다 싸다.

| # | 규칙 | 판정 |
|---|---|---|
| 1 | 나레이션이 씬 길이에 들어감 (여백 ≥ 0.45초) | 실패 |
| 2 | 정적 과다 아님 (여백 ≤ 2.2초) | 실패 |
| 3 | 프레임 합계 ≈ frontmatter `duration` | 경고 (상류가 advisory 로 둠) |
| 4 | 강조 구간 뒤가 조사로 시작하지 않음 | 실패 |
| 5 | 추정 대비 실측 오차 리포트 | 정보 |

### ② 한국어 나레이션 생성 — `audio.mjs` 대신

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project videos/<name>
```

`SCRIPT.md` 의 들여쓴 발화 블록만 뽑아 wav 를 만들고, **상류와 같은 형식의
`audio_meta.json`** 을 쓴다. 그래서 Step 4 이후는 수정 없이 그대로 돈다.

사전 준비 (한 번만):
```bash
python3 -m venv .venv && .venv/bin/pip install piper-tts
# 음성 모델 (61MB) — .onnx 와 .onnx.json 두 개를 나란히 받는다
mkdir -p voices && curl -L -o voices/ko_KR-kss-medium.onnx \
  https://github.com/jacob-cha-builder/hyperframes-ko/releases/download/voices--v1/ko_KR-kss-medium.onnx
curl -L -o voices/ko_KR-kss-medium.onnx.json \
  https://github.com/jacob-cha-builder/hyperframes-ko/releases/download/voices--v1/ko_KR-kss-medium.onnx.json
export PIPER_PYTHON=$PWD/.venv/bin/python
export PIPER_VOICE=$PWD/voices/ko_KR-kss-medium.onnx
```

> ⚠️ 2026-08 기준 Piper 의 한국어 음성은 **`kss/medium` 하나뿐**이다 — 여성 단일 화자, medium 등급.
> 남성 음성이나 화자 변경이 필요하면 이 경로로는 안 되고 HeyGen 로그인이 필요하다.

> ⚠️ 이 음성 모델은 **CC BY-NC-SA 4.0** 이다 (KSS 데이터셋 조건을 물려받는다).
> **상업적 용도로는 쓸 수 없다.**

**자막용 단어 타임스탬프**는 `words: []` 로 비워 둔다. 필요하면 whisper 로 채운다:
```bash
npx hyperframes transcribe videos/<name>/audio/line-01.wav --language ko --json
```
한글은 `whisper/normalize.ts` 에서 CJK 붙임 규칙에서 **의도적으로 제외**되어 공백 분리가 정상이다.
받아쓴 텍스트가 원문과 다르면 **타임스탬프만 취하고 텍스트는 `SCRIPT.md` 원문을 쓴다.**

### ③ 실측 재검사

같은 명령을 다시 돌린다. `audio_meta.json` 이 있으면 추정 대신 **실측**으로 판정한다.
추정이 통과해도 실측에서 걸릴 수 있다 — 실제로 그런 사례가 있다 (추정 3.96초 통과 →
실측 4.08초로 여백 0.42초 < 0.45초 실패). 그래서 두 번 돌린다.

## 사용자가 프롬프트를 쓸 때

`references/korean-prompting.md` 를 읽어라. 상류 프롬프팅 문서
(<https://hyperframes.heygen.com/prompting/overview>, 오프라인은
`~/.claude/plugins/marketplaces/hyperframes/docs/prompting/*.mdx` 32개)에 얹는 델타다. 요지:

- **길이를 선언하지 마라.** 상류는 `8-second video` 처럼 선언하지만, 한국어는 대본에서
  길이를 **도출**한다. 프롬프트에는 음절 예산을 준다 (20초/4씬 ≈ 한글 82음절).
- **`[copy]` 를 화면/나레이션 두 필드로 쪼개라.** `"14가지"` (화면) vs `"열네 가지입니다"` (나레이션).
- **`[negatives]` 에 `ko-tts` 를 명시하라.** 안 그러면 기본 Kokoro 경로로 흘러가는데 한국어가 없다.
- **나레이션에는 스펙 다이얼이 없다** — 비주얼은 무드 워드로 맡겨도 되지만 나레이션 문장은
  항상 최종 문장 그대로여야 한다. 추정기가 그 문자열을 센다.

## 대본을 쓸 때

`references/korean-narration.md` 를 읽어라. 요지:

- **조사를 강조에 포함시켜라** — `"3시간"` 이 아니라 `"3시간을"`. 안 그러면 잔여가
  `"을 잃고 있습니다"` 로 시작한다.
- **나레이션에는 읽는 대로** 쓰고 화면 카피에는 숫자로 — `narration: "열네 가지"` / `copy: "14가지"`.
- 화면 카피 상한: 16:9 = 7단어/32자, 9:16 = 5단어/20자, 1:1 = 6단어/26자.

## 컴포지션에 한글을 넣을 때 (Step 4 이후)

`references/korean-typography.md` 를 읽어라. 실측으로 확인한 두 가지:

- **한글 폰트는 `@font-face` 를 선언해야 한다.** 자동 해석 목록에 없어서 조용히 폴백한다.
  OS 번들 폰트는 `src: local("AppleSDGothicNeo-Bold")` 로 충분하다 — `lint` 가 에러로 잡는다.
- **본문에 `word-break: keep-all` 을 넣어라.** 없으면 어절 한가운데에서 줄이 끊긴다
  (`무너집니다` → `무너` / `집니다`). **`check` 가 못 잡는다** — 깨진 상태로 0 에러 통과한다.
  `snapshot --zoom ".head"` 로 눈으로 봐야 한다.

## 한국어가 아니면

이 스킬은 비켜선다. `SCRIPT.md` 가 없으면 검사기가 그대로 통과시키고,
영어 프로젝트는 상류 `audio.mjs` 를 쓰면 된다.
