# 사용 매뉴얼 — oh-my-easy-video / script-to-motion

이 문서는 **사람이 손으로 따라 하는 실전 가이드**다. 역할이 겹치는 다른 두 문서와 이렇게 나뉜다:

| 문서 | 대상 | 용도 |
|---|---|---|
| `README.md` | 사람 | 왜 이 플러그인이 필요한지, 설치 |
| `plugins/script-to-motion/skills/ko-video/SKILL.md` | Claude(에이전트) | 영상 제작 중 자동으로 참고하는 체크리스트 |
| **이 문서** | 사람 | 처음부터 끝까지 손으로 따라 하며 실제로 뭘 치는지 |

버전: `script-to-motion` v1.3.0 기준 (2026-08-28)

---

## 실제로 어떻게 진행되나 (예시)

**이 플러그인의 핵심은 명령어가 아니라 대화 방식이다.** 준비물만 갖춰 두면, 나머지는
Claude에게 이런 식으로 말을 걸면 된다 — 아래는 실제 대화 흐름의 예시다:

> **나**: 우리 SOEC(고체산화물 수전해) 기술 설명하는 발표자료 있는데, 이걸로 2분짜리
> 설명영상 만들어줘. [슬라이드 5장 첨부]
>
> **Claude**: 자료를 봤습니다. 슬라이드를 하나씩 짚어볼게요.
> - 슬라이드 1(셀 구조 단면도) — `constellation-hub`로 연료극·전해질·공기극이 하나씩
>   나타나며 조립되는 형태로 만들면 어떨까요?
> - 슬라이드 2(효율 비교 막대그래프) — `data-chart`로 숫자가 카운트업되며 나타나게
>   할까요, 아니면 `bar-chart-race`로 경쟁하듯 보여줄까요?
>
> **나**: 1번은 좋고, 2번은 카운트업으로.
>
> **Claude**: 좋습니다. 그럼 톤은 차분한 다큐 느낌으로 갈까요, 아니면 스타트업 피치처럼
> 에너지 있게 갈까요? [...컨셉이 확정될 때까지 계속 질문...]

이렇게 **자료를 하나씩 짚어 구체적으로 제안하고, 매번 확인받은 뒤에만 다음으로 넘어간다** —
한꺼번에 요약해서 넘겨짚지 않는다. 컨셉이 확정되면 `/hyperframes`가 스토리보드를 쓰고,
이 플러그인이 그 사이(대본 검사·한국어 음성·진행상태 안내)에 조용히 끼어든다. 이 대화
원칙은 `skills/ko-video/SKILL.md`의 "진행 방식" / "자료를 받았을 때" 절에 있다.

**아래부터는 그 대화 뒤에서 실제로 무슨 명령이 돌아가는지, 막혔을 때 뭘 치면 되는지에
대한 기술 레퍼런스다** — 평소엔 안 봐도 되고, 문제가 생기거나 궁금할 때 찾아보면 된다.

---

## 0. 준비물 (한 번만)

```bash
# 1) HyperFrames 본체 + 이 마켓플레이스 등록
claude plugin marketplace add heygen-com/hyperframes --scope local
claude plugin marketplace add jacob-cha-builder/oh-my-easy-video --scope local
claude plugin install script-to-motion@oh-my-easy-video --scope local
# 설치 후 Claude Code 재시작 필수 — 안 하면 "Unknown skill: hyperframes"

# 2) 한국어 TTS(Piper) — 이것도 한 번만
python3 -m venv .venv && .venv/bin/pip install piper-tts
mkdir -p voices && curl -L -o voices/ko_KR-kss-medium.onnx \
  https://github.com/jacob-cha-builder/oh-my-easy-video/releases/download/voices--v1/ko_KR-kss-medium.onnx
curl -L -o voices/ko_KR-kss-medium.onnx.json \
  https://github.com/jacob-cha-builder/oh-my-easy-video/releases/download/voices--v1/ko_KR-kss-medium.onnx.json
```

**세션마다 한 줄** (터미널을 새로 열 때마다):

```bash
source tts-env.sh
```

> ⚠️ 이 음성(`kss/medium`)은 CC BY-NC-SA 4.0 — **상업적 용도로 쓸 수 없다.** 남성 목소리나
> 다른 화자가 필요하면 이 경로로는 안 되고 HeyGen 로그인이 필요하다 (`npx hyperframes auth login`).

---

## 1. 새 영상 만들기 — 처음부터 끝까지

### 1-0. 자료가 있다면 먼저 첨부

발표자료, 스크린샷, 참고할 사이트 URL이 있으면 **글로 옮겨 적지 말고 그대로 첨부**하고
다음 단계로 넘어가라. Claude가 직접 읽는다 — 별도 OCR이나 변환 과정은 필요 없다.

### 1-1. `/hyperframes` 로 시작

```
Using /hyperframes, [원하는 영상 설명]
```

인터뷰(경로 확인, 필수 질문 몇 개)에 답하면 `BRIEF.md`가 생긴다. **여기서부터 스토리보드
검토·렌더까지는 전부 `/hyperframes` 소관** — 이 플러그인은 개입하지 않는다.

### 1-2. 스토리보드 + 대본 작성

`/hyperframes`가 `STORYBOARD.md`와 (나레이션이 있으면) `SCRIPT.md`를 쓴다. 저장하는 순간
훅이 자동으로 사전검사를 돌린다 — 다음 단계를 수동으로 안 돌려도 결과가 stderr에 뜬다.

### 1-3. 대본 사전검사 (수동으로도 가능)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project videos/<프로젝트명>
```

**실제 출력 예시** (2026-08-24, `soec-explainer` 24줄, 오디오 생성 전 — 추정 기반):

```
✔ 한국어 나레이션 검사 통과 — 24줄 / 발화 151.3초 (추정 — 오디오 생성 후 재검사하세요)

▶ 다음 단계: check-script.mjs 로 사전검사 통과 확인 후 ko-tts.mjs 실행
  node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project videos/soec-explainer
```

`✘`로 실패하면 **오디오를 만들기 전에** 대본이나 STORYBOARD.md의 프레임 길이를 고쳐라 —
대본 고치는 게 오디오 다시 만드는 것보다 항상 싸다.

### 1-4. 한국어 음성 생성

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project videos/<프로젝트명>
```

**실제 출력 예시** (2026-08-24, `soec-explainer` 24줄 — 축약):

```
▶ 24줄 합성 — ko_KR-kss-medium.onnx

   1. 5.05s  [9단어]  수소를 만드는 가장 깨끗한 방법은, 물을 전기로 쪼개는 것입니다.
   2. 5.06s  [9단어]  그런데 물은 저절로 갈라지지 않습니다. 에너지를 넣어 주어야 합니다.
  ⚠ .../audio/line-03.wav: whisper 토큰 수(9)가 원문 어절 수(10)와 달라 받아쓴 텍스트를
    그대로 둡니다 — words[] 를 육안으로 확인하세요
   3. 4.98s  [9단어]  그리고 그 전기 값이, 수소 원가에서 가장 큰 몫을 차지합니다.
   ...

✔ 24개 / 총 151.34초
  words[] 확보: 24/24줄 (whisper, --model small)
  videos/soec-explainer/audio_meta.json

다음: node check-script.mjs --project videos/soec-explainer  (실측 반영 재검사)
```

- **매 줄마다 오디오 + 단어 타임스탬프까지 자동으로** 생긴다. `⚠` 경고는 **텍스트 오독**
  경고이지 타임스탬프 실패가 아니다 — 화면 요소를 나레이션 타이밍에 맞추는 용도로는 경고가
  떠도 그대로 쓸 수 있고, 캡션에 정확한 글자가 꼭 필요할 때만 그 줄을 눈으로 다시 보면 된다.
  (실측: 28줄 중 43%만 whisper 토큰 수가 원문과 정확히 일치했다 — 흔한 일이다.)
- 캡션이 필요 없어서 더 빠르게 돌리고 싶으면 `--no-words`.
- 잡음 많은 오디오는 `--whisper-model medium`.
- 첫 실행은 whisper `small` 모델(466MB)을 받느라 느릴 수 있다.

### 1-5. 실측 재검사 (반드시 다시 돌린다)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project videos/<프로젝트명>
```

추정이 통과해도 실측에서 걸릴 수 있다(실제 사례: 추정 3.96초 통과 → 실측 4.08초로 여백
0.42초 < 0.45초 실패). **오디오 생성 후 검사를 건너뛰지 마라.**

### 1-6. 기술적인 내용을 설명해야 한다면

절차·아키텍처·코드·수치 비교 같은 걸 다뤄야 하면 `references/korean-technical-explainer.md`를
읽어라. "이럴 땐 이 레지스트리 블록" 매핑표와, 디자인 방향이 안 잡혔을 때 **claude-in-chrome으로
실제 사이트를 방문해 스크린샷을 보고 스타일을 옮겨오는 방법**이 있다. §5에 요약.

### 1-7. Step 4 이후 — 상류 그대로

여기부터는 `/hyperframes`가 그대로 진행한다: 비주얼 채우기 → `npx hyperframes lint` →
`npx hyperframes check` → `npx hyperframes render`. 이 플러그인은 더 이상 개입하지 않는다.

---

## 2. 막혔을 때 — "지금 어디까지 됐지?"

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-status.mjs" --project videos/<프로젝트명>
```

`SCRIPT.md`가 아직 없어도 동작한다. 다음에 정확히 뭘 실행해야 하는지 알려준다. **실제 상태
전이 예시** (2026-08-24 실측):

| 상태 | 의미 | 다음 명령 |
|---|---|---|
| `no-storyboard` | STORYBOARD.md 없음 | `/hyperframes` 로 스토리보드부터 |
| `no-script` | STORYBOARD.md만 있음 | SCRIPT.md 작성 (비주얼 전용이면 무시) |
| `no-audio` | SCRIPT.md 있음, 오디오 없음 | `check-script.mjs` → `ko-tts.mjs` |
| `missing-words` | audio_meta.json 있음, 일부 줄 words[] 없음 | `ko-tts.mjs` 재실행 |
| `ready-to-render` | words[] 전부 있음, 아직 렌더 안 함 | `check-script.mjs` 실측 재검사 |
| `rendered` | `renders/*.mp4` 있음 | `npx hyperframes snapshot` 으로 육안 확인 |

---

## 3. 자주 쓰는 명령 모음

```bash
# 세션 시작
source tts-env.sh

# 대본 검사 (오디오 전/후 둘 다)
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project videos/<name>

# 한국어 음성 생성 (기본: whisper 자동 병합)
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project videos/<name>
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project videos/<name> --no-words
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project videos/<name> --whisper-model medium

# 지금 어디까지 됐는지
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-status.mjs" --project videos/<name>

# 단어 타임스탬프 수동 채우기 (--no-words 로 껐거나 실패한 줄만)
npx hyperframes transcribe videos/<name>/audio/line-01.wav --model small --language ko --json
```

---

## 4. 문제 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| whisper 전사 결과가 영어로 나온다 | `--model`을 안 붙임 — CLI 기본값 `small.en`이 비영어를 조용히 영어로 번역 | `--model small --language ko` 명시 |
| `words[]` 텍스트가 원문과 다르다 | whisper 오독(흔함, 43%만 일치) | 타임스탬프는 정상 — 캡션에 정확한 글자가 필요할 때만 그 줄을 손으로 고침 |
| `audio/transcript.json`이 안 보인다 | `ko-tts.mjs`가 매 줄 처리 직후 자동으로 지움(다음 줄이 같은 경로를 덮어쓰기 때문) | 정상 동작 — 결과는 `audio_meta.json`에 이미 들어감 |
| `check-script.mjs`가 규칙 1에서 실패 | 나레이션이 씬 길이보다 김(여백 0.45초 미만) | 씬을 늘리거나 대본을 줄임 — 제안 프레임 수가 에러 메시지에 나옴 |
| `Unknown skill: hyperframes` | 설치 후 재시작 안 함 | Claude Code 세션 재시작 |
| `piper 를 찾을 수 없습니다` | `tts-env.sh`를 source 안 함, 또는 `.venv` 미설치 | §0 다시 실행 |
| 이 음성으로 상업 영상을 만들어야 한다 | `kss/medium`은 CC BY-NC-SA 4.0 | HeyGen 로그인 경로로 전환 (`npx hyperframes auth login`) |

---

## 5. 기술 설명 영상 만들기 (요약)

전체 내용: `plugins/script-to-motion/references/korean-technical-explainer.md`

**패턴별 추천 블록** (8종, 실재하는 상류 레지스트리 블록만):

| 상황 | 블록 |
|---|---|
| 절차/순서 | `flowchart`, `flowchart-vertical` |
| 아키텍처 관계 | `constellation-hub` |
| 코드 동작 | `code-typing`, `code-diff`, `code-morph`, `code-highlight`, `code-3d-extrude` |
| 수치 비교 | `data-chart`, `animated-bar-chart`, `bar-chart-race`, `count-up`, `chart-story` |
| 지리/분포 | `world-map`, `us-map` 계열 |
| 전후 비교 | `before-after-wipe`, `comparison-split`, `grade-split-reveal` |
| 단계별 진행 | `state-chip-rail`, `conic-progress-ring`, `telemetry-hud` |

**디자인 방향이 안 잡히면** — claude-in-chrome 스킬로 참고 사이트(지정한 게 없으면
`hyperframes.heygen.com/examples`)를 방문해 스크린샷을 찍고, 색상·레이아웃·모션 단서를
프롬프트의 `[technique]`/`[style]` 슬롯에 옮겨 담는다. 라벨 길이는 그 사이트가 한국어가
아니면 그대로 베끼지 말고 `korean-narration.md`의 한국어 카피 상한으로 다시 계산한다.

---

## 6. 더 읽을 거리

| 언제 | 문서 |
|---|---|
| 대본에 조사·숫자·화면 카피 상한이 헷갈릴 때 | `references/korean-narration.md` |
| 컴포지션에 한글이 깨지거나 줄바꿈이 이상할 때 | `references/korean-typography.md` |
| 프롬프트를 어떻게 써야 할지 모를 때 | `references/korean-prompting.md` |
| 기술 설명 시각화, 참고 사이트 확인 | `references/korean-technical-explainer.md` |
| 이 플러그인의 설계 근거·조사 기록 | `.lazycc/plans/ko-guided-explainer.md`, `.lazycc/evidence/ko-guided-explainer.md` |
