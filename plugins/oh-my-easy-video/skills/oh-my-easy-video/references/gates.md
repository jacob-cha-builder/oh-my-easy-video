# 한국어 게이트 — 검사 규칙과 TTS 상세

`SKILL.md` §3 이 부르는 두 스크립트의 상세다.

## `check-script.mjs` — 검사 규칙 7종

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project <dir>
```

`STORYBOARD.md` 의 프레임 `duration` 과 `SCRIPT.md` 의 발화 텍스트를 대조한다.
`audio_meta.json` 이 있으면 추정 대신 **실측**으로 판정한다.

| # | 규칙 | 판정 |
|---|---|---|
| 1 | 나레이션이 씬 길이에 들어감 (여백 ≥ 0.45초) | 실패 |
| 2 | 정적 과다 아님 (여백 ≤ 2.2초) | 실패 |
| 3 | 프레임 합계 ≈ frontmatter `duration` | 경고 (상류가 advisory 로 둠) |
| 4 | 강조 구간 뒤가 조사로 시작하지 않음 | 실패 |
| 5 | 추정 대비 실측 오차 리포트 | 정보 |
| 6 | 캡션 동기화용 단어 타임스탬프(`words[]`) 존재 | 경고 |
| 7 | 나레이션에 라틴문자 없음 (`korean-terminology.md`) | 경고 |

**exit 1 이면 오디오를 만들지 마라.** 대본을 고치는 게 오디오를 다시 만드는 것보다 싸다.

이 스크립트는 `SCRIPT.md`/`STORYBOARD.md` 를 저장할 때마다 훅으로도 자동 실행된다
(`hooks/hooks.json`).

## `check-captions.mjs` — 자막 검사 규칙 4종

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-captions.mjs" --project <dir>
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-captions.mjs" --project <dir> --max-chars 24   # 세로형
```

`compositions/` 와 `.hyperframes/` 에서 캡션 컴포지션을 찾아 CSS 와 `GROUPS` 를 읽는다.
상류 캡션 프리셋은 영어 쇼츠 문법(잘게 쪼갠 그룹 + 단어별 이동 하이라이트)이라, 한국어
문장을 읽어야 하는 영상에서는 그대로 두면 문장이 조각난다.

| # | 규칙 | 판정 |
|---|---|---|
| 1 | `.is-active`/`.is-spoken` 이 기본과 다른 색·밑줄을 칠하지 않음 | 실패 |
| 2 | 캡션 단어에 `scale` 트윈 없음 | 실패 |
| 3 | 그룹이 문장 중간에서 끊기지 않음 | 실패 |
| 4 | 한 그룹 글자 수 ≤ `--max-chars` (기본 40) | 경고 |

**캡션을 붙인 뒤 렌더 전에 돌린다.** 고치는 법과 실측 근거는 `korean-captions.md`.
자막 없는 프로젝트면 조용히 통과한다(exit 0).

## `ko-tts.mjs` — 한국어 나레이션 생성

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project <dir>
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project <dir> --no-words         # 오디오만, 빠름
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project <dir> --whisper-model medium
```

`SCRIPT.md` 의 들여쓴 발화 블록만 뽑아 wav 를 만들고, **상류와 같은 형식의
`audio_meta.json`** 을 쓴다. 그래서 이후 단계가 수정 없이 그대로 돈다.

기본으로 줄마다 whisper 를 돌려 `words[]`(단어 타임스탬프)까지 채운다.

### whisper 는 타임스탬프만 신뢰한다

받아쓴 텍스트에는 오독이 섞인다 (실측: "AI로" → "8으로"). 원문과 어절 수가 같으면 자동으로
원문 어절로 치환하고, 다르면 whisper 텍스트를 그대로 두고 stderr 로 경고한다. 28줄 실측에서
**43%만 일치**했으니 경고는 흔하다.

**타임스탬프 자체는 실패하지 않는 한 항상 확보된다.** whisper 호출이 실패해도 그 줄만
`words: []` 로 남고 배치는 계속 진행한다.

수동으로 채울 때는 **`--model` 을 반드시 명시**하라 — CLI 기본값 `small.en` 은 비영어
오디오를 조용히 영어로 번역해버린다:

```bash
npx hyperframes transcribe <dir>/audio/line-01.wav --model small --language ko --json
```

`--json` 은 요약만 stdout 에 찍는다. 실제 단어 배열은 `transcriptPath` 가 가리키는 파일
(`<wav 와 같은 디렉토리>/transcript.json`, **파일명 고정 — 다음 줄 호출 시 덮어써진다**)에
있으니 한 줄 처리할 때마다 읽고 지워야 한다.

### 왜 단어 타임스탬프가 필요한가

상류의 화면 리빌 타이밍이 여기에 전적으로 의존한다 (`prompting/media-and-audio.md`
"Pace reveals to the narration": *"the agent gets word timings for free"*). Piper 는 이걸
기본 제공하지 않으므로, 채워주지 않으면 **한국어 영상만 이 메커니즘이 꺼진 채로** 만들어진다.

## `melo-tts.mjs` — MeloTTS 로 대신 만들기 (상업적 용도)

`ko-tts.mjs` 와 완전히 같은 자리에 쓴다 — 입력(`SCRIPT.md`)도 출력(`audio_meta.json` 형식)도
같다. 다른 건 합성 엔진뿐이다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/melo-tts.mjs" --project <dir>
node "${CLAUDE_PLUGIN_ROOT}/scripts/melo-tts.mjs" --project <dir> --no-words
node "${CLAUDE_PLUGIN_ROOT}/scripts/melo-tts.mjs" --project <dir> --whisper-model medium
```

단어 타임스탬프 확보 방식(whisper, 원문 어절 치환 휴리스틱, `--model` 필수)은 `ko-tts.mjs`
와 동일하다. 다른 점 하나: **`narration.mjs` 의 5.5음절/초 추정 상수는 Piper 기준이라
MeloTTS 에는 안 맞는다** (실측 평균 18~20% 과소추정 — `korean-narration.md` 참고). ①의
추정 검사를 통과했다고 안심하지 말고 ③ 실측 재검사를 반드시 돌려라.

## 음성 모델

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs"                 # Piper (기본)
node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs" --engine melo   # MeloTTS
```

파이썬 venv · TTS 엔진 · (Piper 는) 음성 모델까지 받아 검증하고 준비 상태를 찍는다. 둘 다
멱등하고, venv 가 분리돼 있어 둘 다 설치해도 서로 간섭하지 않는다.

> ⚠️ 2026-08 기준 Piper 의 한국어 음성은 **`kss/medium` 하나뿐**이다 — 여성 단일 화자,
> **CC BY-NC-SA 4.0 (상업적 용도 불가)**. 남성 음성이나 화자 변경이 필요하면 이 경로로는
> 안 되고 HeyGen 로그인(`npx hyperframes auth login`)이 필요하다. **상업적 용도**만
> 필요하고 화자는 그대로여도 되면 MeloTTS(`--engine melo`)로 바꿔라 — 역시 한국어 화자는
> 하나뿐이지만 라이선스가 더 자유롭다.

> ⚠️ 이 음성 모델은 **CC BY-NC-SA 4.0** (KSS 데이터셋 조건을 물려받는다).
> **상업적 용도로는 쓸 수 없다.** 자세한 건 저장소 `NOTICE.md`.
