---
name: ko-video
description: 한국어 나레이션 영상의 대본 길이를 검사하고 한국어 TTS 를 생성한다. HyperFrames 로 한국어 영상을 만들 때 STORYBOARD.md / SCRIPT.md 를 쓴 뒤 오디오 단계 전에 사용. 발화 길이·조사·정적을 본다. 파이프라인 자체는 /hyperframes 가 소유한다.
---

# ko-video — HyperFrames 한국어 보조 레이어

**이 스킬은 파이프라인을 소유하지 않는다.** 인터뷰·라우팅·스토리보드·디자인·모션·렌더는
전부 `/hyperframes` 와 그 워크플로가 owner 다. 여기는 **한국어에서만 생기는 구멍**을 메운다.
막히면 언제든 `node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-status.mjs" --project <dir>` 로 다음
할 일을 물어라 — 아래 체크리스트는 그 명령이 안내하는 순서를 그대로 적어둔 것이다.

## 진행 방식 — 넘겨짚지 말고 계속 확인한다

한 번에 다 만들어서 통보하지 않는다. **각 단계에서 제안하고, 사용자 확인을 받은 뒤에만
다음으로 넘어간다.**

- **컨셉을 잡을 때**: `/hyperframes` 인터뷰를 짧게 끝내려 하지 마라. 사용자가 "이거다"
  싶어질 때까지 계속 물어라.
- **자료(사진·스크린샷·다이어그램·발표자료)를 받았을 때**: 아래 "자료를 받았을 때" 절을
  따라 **하나씩** 짚으며 제안하고 확인받는다 — 전부 훑고 한꺼번에 만들지 않는다.
- **어떤 HyperFrames 스킬을 쓸지**: 미리 다 계획해서 통보하지 말고, 그 순간 필요한 것만
  (`hyperframes-animation`, `hyperframes-creative`, `media-use` 등) 적시에 불러 쓴다.

이 원칙은 아래 체크리스트의 모든 단계에 적용된다.

## 자료를 받았을 때 — 하나씩 확인하며 진행

사용자가 발표자료, 스크린샷, 사진, 다이어그램을 던지면 전체를 한 번에 요약해 넘겨짚지 않는다.
자료 안의 시각 요소(그림·사진·다이어그램·표) **하나하나**에 대해:

1. 그 요소가 뭘 보여주려는 건지 짚는다 — "이 그림은 [X]를 설명하는 것 같습니다."
2. `references/korean-technical-explainer.md` 매핑표에서 어떤 HyperFrames 블록으로
   "움직이게" 만들지 **구체적으로** 제안한다 — "이 아키텍처 그림은 `constellation-hub`로
   노드가 하나씩 나타나게 만들면 어떨까요?" 식으로. 그냥 "애니메이션 처리하겠습니다"는
   제안이 아니다.
3. **반드시 확인을 받는다.** 맞다고 하면 다음 요소로, 아니면 다시 제안한다.
4. 확정된 것부터 스토리보드(체크리스트 2단계)에 반영한다.

자료의 모든 시각 요소를 훑을 때까지, 그리고 사용자가 "이제 됐다"고 할 때까지 반복한다.

`/hyperframes` 인터뷰(피치 라운드, "material answered on arrival")가 이미 비슷한 걸
하지만 범용이라 자료 하나하나를 짚어주지 않는다 — 이 절이 **기술 설명/자료 중심 한국어
프로젝트**에 한해 그 빈틈을 메운다. 상류 인터뷰 자체를 대체하지 않는다.

## 체크리스트 — 위에서부터 그대로 따라가면 된다

```
0. 자료가 있는가? (발표자료, 스크린샷, 참고 사이트 URL 등)
   → 있으면 먼저 첨부/제시받아라. 아래 "자료를 받았을 때" 절을 따라 하나씩 짚으며 제안·확인한
     뒤 /hyperframes 를 불러라. 넘겨짚고 한꺼번에 처리하지 않는다.

1. /hyperframes 인터뷰에 응답 → BRIEF.md 생성 확인
   (여기부터 ③까지는 전부 /hyperframes 소관 — 이 스킬은 개입하지 않는다)

2. STORYBOARD.md + SCRIPT.md 작성 완료
   → node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-status.mjs" --project <dir>  (다음 할 일 확인)

3. 나레이션이 있는 한국어 프로젝트라면 —
   node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project <dir>   ← ① 사전검사
   exit 1 이면 오디오 만들기 전에 대본부터 고쳐라 (§① 상세 규칙표는 아래)

4. 나레이션이 있는 한국어 프로젝트라면 —
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project <dir>         ← ② TTS + 단어 타임스탬프
   audio_meta.json 생성 확인

5. node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project <dir>   ← ③ 실측 재검사
   추정이 통과해도 실측에서 걸릴 수 있다 — 반드시 다시 돌린다

6. 기술적인 내용(절차·아키텍처·코드·수치·비교)을 설명해야 한다면 →
   references/korean-technical-explainer.md 를 읽고 비주얼 방향을 정하라.
   참고할 실제 사례가 필요하면 같은 문서의 "실제 사례 확인하기" 절 참고 (claude-in-chrome 사용).

7. Step 4(비주얼) 이후는 /hyperframes 가 그대로 진행 — check / lint / render.
   막히면 언제든 ko-status.mjs.
```

---

## 왜 필요한가 (근거)

1. **HyperFrames 의 TTS 에 한국어가 없다.** 번들된 Kokoro 는 9개 언어(미/영 영어, 일본어,
   중국어, 스페인·프랑스·힌디·이탈리아·포르투갈)뿐이고 한국어가 빠져 있다
   (`hexgrad/Kokoro-82M` 의 `VOICES.md` 기준). HeyGen 클라우드는 로그인이 필요하다.
2. **상류는 나레이션 길이를 추정하지 않고 측정한다.** `SCRIPT.md` 스펙이 `**Time:**` 을
   *"a guide, not authoritative"* 라고 못박고 실측은 Step 3.1 에서야 나온다. 영어권 작성자는
   wpm 감각으로 대본이 컷에 맞는지 짐작하지만 **한국어는 그 감각이 전이되지 않는다.**
3. **화면 리빌 타이밍이 단어 타임스탬프에 전적으로 의존한다.**
   (`prompting/media-and-audio.md` "Pace reveals to the narration": *"the agent gets word
   timings for free"*). 한국어 TTS(Piper)는 그 타임스탬프를 기본 제공하지 않으므로,
   채워주지 않으면 한국어 영상만 이 메커니즘이 꺼진 채로 만들어진다.

## ① 대본 사전 검사 — 오디오 만들기 전

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
| 6 | 캡션 동기화용 단어 타임스탬프(`words[]`) 존재 | 경고 |

## ② 한국어 나레이션 생성 — `audio.mjs` 대신

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project videos/<name>
```

`SCRIPT.md` 의 들여쓴 발화 블록만 뽑아 wav 를 만들고, **상류와 같은 형식의
`audio_meta.json`** 을 쓴다. 그래서 Step 4 이후는 수정 없이 그대로 돈다.

기본으로 각 줄마다 whisper 를 자동으로 돌려 `words[]`(단어 타임스탬프)까지 채운다. 캡션이
필요 없어 속도가 더 급하면 끌 수 있다:

```bash
node ko-tts.mjs --project videos/<name>                       # 기본: whisper 자동 병합
node ko-tts.mjs --project videos/<name> --no-words              # 오디오만, whisper 생략(빠름)
node ko-tts.mjs --project videos/<name> --whisper-model medium  # 잡음 많은 오디오용
```

whisper 는 **타임스탬프만 신뢰한다.** 받아쓴 텍스트는 오독이 섞인다(실측: "AI로" → "8으로").
원문과 어절 수가 같으면 자동으로 원문 어절로 치환하고, 다르면(흔함 — 28줄 실측에서 43%만
일치) whisper 받아쓴 텍스트를 그대로 두고 stderr 로 경고한다. 경고가 뜬 줄은 `words[]` 를
육안으로 확인하라 — **타임스탬프 자체는 실패하지 않는 한 항상 확보된다.** whisper 호출이
실패해도(모델 다운로드 실패 등) 해당 줄만 `words: []` 로 남고 배치 전체는 계속 진행한다.

사전 준비 (한 번만):
```bash
python3 -m venv .venv && .venv/bin/pip install piper-tts
# 음성 모델 (61MB) — .onnx 와 .onnx.json 두 개를 나란히 받는다
mkdir -p voices && curl -L -o voices/ko_KR-kss-medium.onnx \
  https://github.com/jacob-cha-builder/oh-my-easy-video/releases/download/voices--v1/ko_KR-kss-medium.onnx
curl -L -o voices/ko_KR-kss-medium.onnx.json \
  https://github.com/jacob-cha-builder/oh-my-easy-video/releases/download/voices--v1/ko_KR-kss-medium.onnx.json
export PIPER_PYTHON=$PWD/.venv/bin/python
export PIPER_VOICE=$PWD/voices/ko_KR-kss-medium.onnx
```

> ⚠️ 2026-08 기준 Piper 의 한국어 음성은 **`kss/medium` 하나뿐**이다 — 여성 단일 화자, medium 등급.
> 남성 음성이나 화자 변경이 필요하면 이 경로로는 안 되고 HeyGen 로그인이 필요하다.

> ⚠️ 이 음성 모델은 **CC BY-NC-SA 4.0** 이다 (KSS 데이터셋 조건을 물려받는다).
> **상업적 용도로는 쓸 수 없다.**

`--no-words` 로 껐거나 실패한 줄만 수동으로 채운다 — **`--model` 을 반드시 명시**해야 한다
(CLI 기본값 `small.en` 은 비영어 오디오를 조용히 영어로 번역해버린다):
```bash
npx hyperframes transcribe videos/<name>/audio/line-01.wav --model small --language ko --json
```
`--json` 은 요약만 stdout 에 찍고, 실제 단어 배열은 `transcriptPath` 가 가리키는 파일
(`<wav와 같은 디렉토리>/transcript.json`, 파일명 고정 — 다음 줄 호출 시 덮어써진다)에 있다.
한글은 `whisper/normalize.ts` 에서 CJK 붙임 규칙에서 **의도적으로 제외**되어 공백 분리가 정상이다.

## ③ 실측 재검사

같은 명령을 다시 돌린다. `audio_meta.json` 이 있으면 추정 대신 **실측**으로 판정한다.
추정이 통과해도 실측에서 걸릴 수 있다 — 실제로 그런 사례가 있다 (추정 3.96초 통과 →
실측 4.08초로 여백 0.42초 < 0.45초 실패). 그래서 두 번 돌린다.

## 진행상태 확인 — 아무 때나

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-status.mjs" --project videos/<name>
```

`SCRIPT.md` 가 아직 없어도(체크리스트 0~2 단계여도) 동작한다. 이건 **상류 `/hyperframes` 의
재개 로직을 대체하지 않는다** — 그건 `BRIEF.md`/`hyperframes.json`/`STORYBOARD.md` 로 워크플로
전체를 재개하고, 이 명령은 그중 **한국어 전용 분기점**(오디오 생성 전후)만 좁게 본다.

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

## 기술적인 설명이 필요할 때

`references/korean-technical-explainer.md` 를 읽어라. 절차·아키텍처·코드·수치 비교 같은
기술 설명에 상류 레지스트리의 어떤 블록을 쓸지 매핑한 표와, 참고 사이트를 실제로 확인하는
방법(claude-in-chrome)이 있다. **새 시각화 프리미티브를 만드는 문서가 아니다** — 이미 있는
`/hyperframes-registry` 176종 중 한국어 기술 설명에 맞는 것을 고르는 가이드다.

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
