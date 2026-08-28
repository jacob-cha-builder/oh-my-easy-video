# script-to-motion — HyperFrames 한국어 레이어

[HyperFrames](https://github.com/heygen-com/hyperframes) 로 **한국어 나레이션 영상**을 만들 때
생기는 구멍들을 메우는 Claude Code 플러그인.

**파이프라인을 소유하지 않는다.** 인터뷰·스토리보드·HTML 스케치 보드·디자인 프리셋·모션·
레지스트리 176종·렌더는 전부 HyperFrames 가 owner 다. 이 플러그인은 그 위에 얇게 얹힌다.

> 처음부터 끝까지 실제 명령·실제 출력으로 따라 하려면 **[`MANUAL.md`](MANUAL.md)** 를 봐라.

## 왜 필요한가

### 1. HyperFrames 의 TTS 에 한국어가 없다

번들된 Kokoro-82M 은 9개 언어를 지원하는데 한국어가 빠져 있다
([`VOICES.md`](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) 기준 —
미/영 영어, 일본어, 중국어, 스페인·프랑스·힌디·이탈리아·포르투갈어). HeyGen 클라우드 경로는
로그인이 필요하다. **무료·오프라인으로 한국어를 말하게 하려면 별도 엔진이 필요하다.**

### 2. 상류는 나레이션 길이를 추정하지 않고 측정한다

`SCRIPT.md` 스펙이 `**Time:**` 을 *"a guide, not authoritative"* 라고 못박고, 실측은
오디오 단계에서야 나온다. 영어권 작성자는 wpm 감각으로 대본이 컷에 맞는지 짐작하지만
**한국어는 그 감각이 전이되지 않는다.** 대본이 길면 오디오를 만든 뒤에야 알게 된다.

### 3. 화면 리빌 타이밍이 단어 타임스탬프에 전적으로 의존한다

HyperFrames 는 나레이션 타이밍에 맞춰 화면 요소가 뜨게 만든다(VO-paced reveal) — 이게
공짜로 되는 이유는 TTS 가 단어 단위 타임스탬프를 같이 주기 때문이다. 한국어 TTS(Piper)는
그걸 기본 제공하지 않으므로, 채워주지 않으면 **한국어 영상만 이 메커니즘이 꺼진 채로**
만들어진다.

## 무엇을 하는가

```
/hyperframes → 워크플로 라우팅 → Step 3 (STORYBOARD.md + SCRIPT.md)
                                        │
                              ① check-script   추정 기반 사전 검사
                                        │
                              ② ko-tts        한국어 TTS + 단어 타임스탬프 (audio.mjs 대신)
                                        │
                              ③ check-script   실측 기반 재검사
                                        │
                                  Step 4 이후 (상류 그대로 — 기술 설명이면
                                                references/korean-technical-explainer.md 참고)
```

`node ko-status.mjs --project <name>` 는 위 단계 중 지금 어디에 있고 다음에 뭘 실행해야
하는지 아무 때나 알려준다. `skills/ko-video/SKILL.md` 의 체크리스트가 이 순서를 그대로 따른다.

`ko-tts` 는 상류와 **같은 형식의 `audio_meta.json`** 을 만든다. 상류 코드를 고치지 않으므로
이후 단계가 수정 없이 돈다.

### 검사 규칙

| # | 규칙 | 판정 |
|---|---|---|
| 1 | 나레이션이 씬 길이에 들어감 (여백 ≥ 0.45초) | 실패 |
| 2 | 정적 과다 아님 (여백 ≤ 2.2초) | 실패 |
| 3 | 프레임 합계 ≈ frontmatter `duration` | 경고 (상류가 advisory) |
| 4 | 강조 구간 뒤가 조사로 시작하지 않음 | 실패 |
| 5 | 추정 대비 실측 오차 리포트 | 정보 |
| 6 | 캡션 동기화용 단어 타임스탬프(`words[]`) 존재 | 경고 |

## 설치

```bash
claude plugin marketplace add heygen-com/hyperframes --scope local
claude plugin marketplace add jacob-cha-builder/oh-my-easy-video --scope local
claude plugin install script-to-motion@oh-my-easy-video --scope local
```

`core-skills@hyperframes` 가 **의존성으로 자동 설치**된다. 다만 마켓플레이스는 자동 등록되지
않으므로 위 첫 줄이 필요하다 (없으면 `Is the "hyperframes" marketplace added?` 로 실패).

> ⚠️ **설치 후 Claude Code 를 재시작해야 스킬이 로드된다.** 재시작 전에는
> `Unknown skill: hyperframes` 가 난다.

> ⚠️ 의존성 선언이 `core-skills` 의 비활성화를 막아주지 않는 것을 관측했다
> (문서상으로는 막혀야 한다). `core-skills` 를 끄면 이 플러그인은 동작하지 않는다.

### 한국어 TTS 준비 (한 번만)

```bash
python3 -m venv .venv && .venv/bin/pip install piper-tts
mkdir -p voices && curl -L -o voices/ko_KR-kss-medium.onnx \
  https://github.com/jacob-cha-builder/oh-my-easy-video/releases/download/voices--v1/ko_KR-kss-medium.onnx
curl -L -o voices/ko_KR-kss-medium.onnx.json \
  https://github.com/jacob-cha-builder/oh-my-easy-video/releases/download/voices--v1/ko_KR-kss-medium.onnx.json
```

음성 모델은 [`voices--v1`](https://github.com/jacob-cha-builder/oh-my-easy-video/releases/tag/voices--v1)
릴리즈에 미러링해 뒀다 — 상류
[rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) 와 **바이트 단위로 동일**하고
(SHA-256 은 릴리즈 노트에 있다), HuggingFace 를 거치지 않는다.

그 뒤로는 **세션마다 한 줄**이면 된다 (`.venv/` 와 `voices/` 는 gitignore 된다):

```bash
source tts-env.sh
```

> **한국어 음성은 `kss/medium` 하나뿐이다** (2026-08 기준) — 여성 단일 화자, medium 등급.
> 남성 음성이나 화자 변경이 필요하면 HeyGen 로그인이 필요하다.

> ⚠️ **이 음성 모델은 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 이다**
> — 학습 데이터인 KSS 데이터셋(Kyubyong Park, 전문 여성 성우)의 조건을 그대로 물려받는다.
> **이 음성으로 만든 나레이션은 상업적으로 쓸 수 없다.** 상업적 사용이 필요하면 이 경로로는
> 안 된다. 자세한 범위는 [`NOTICE.md`](NOTICE.md).

> `piper-tts` PyPI 패키지는 [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl)
> 로 **GPL-3.0** 이다. 이 플러그인은 서브프로세스로 호출만 하므로 MIT 를 유지한다.
> GPL 을 피하려면 MIT 인 [rhasspy/piper](https://github.com/rhasspy/piper) 바이너리로
> 바꿔 끼울 수 있다 — 음성 모델 `.onnx` 는 런타임과 분리되어 있어 같은 파일을 쓴다.

## 사용

```bash
# 대본을 쓴 뒤, 오디오 만들기 전
node "$CLAUDE_PLUGIN_ROOT/scripts/check-script.mjs" --project videos/<name>

# 한국어 나레이션 생성
node "$CLAUDE_PLUGIN_ROOT/scripts/ko-tts.mjs" --project videos/<name>

# 실측 반영 재검사
node "$CLAUDE_PLUGIN_ROOT/scripts/check-script.mjs" --project videos/<name>

# 아무 때나 — 지금 어디까지 됐고 다음에 뭘 해야 하는지
node "$CLAUDE_PLUGIN_ROOT/scripts/ko-status.mjs" --project videos/<name>
```

`SCRIPT.md` / `STORYBOARD.md` 를 저장하면 훅이 ①을 자동으로 돌린다.

**자막/화면 싱크용 단어 타임스탬프는 `ko-tts.mjs`가 기본으로 자동 채운다** (whisper를 줄마다
서브프로세스로 호출). 필요 없으면 `--no-words`로 끈다:

```bash
node ko-tts.mjs --project videos/<name>                       # 기본: whisper 자동 병합
node ko-tts.mjs --project videos/<name> --no-words              # 오디오만, whisper 생략(빠름)
```

`--no-words`로 껐거나 실패한 줄만 수동으로 채운다 — **`--model`을 반드시 명시**해야 한다
(CLI 기본값 `small.en`은 비영어 오디오를 조용히 영어로 번역해버린다):

```bash
npx hyperframes transcribe videos/<name>/audio/line-01.wav --model small --language ko --json
```

한글은 상류 `whisper/normalize.ts` 에서 CJK 붙임 규칙에서 의도적으로 제외되어 공백 분리가
정상이다. whisper는 타임스탬프만 신뢰한다 — 받아쓴 텍스트가 원문과 어절 수가 같으면 자동으로
원문으로 치환하고, 다르면 whisper 텍스트를 그대로 두고 경고한다.

## 추정 정확도

한국어 발화 속도 상수(5.5음절/초)를 Piper 실측으로 검증했다.

| 표본 | 평균 상대오차 | 최대 절대오차 |
|---|---|---|
| 9줄 (2026-08-17) | **1.8 ~ 3.2%** | 0.43초 |

게이트 여백(0.45~2.2초)보다 작아 계획 시점 판단에 쓸 수 있다. 다만 마진이 넉넉하지 않고
라틴 약어(`AI` → "에이아이")가 섞이면 과소 추정된다. **추정은 근사이고 실측이 우선이다** —
규칙 5 가 매 실행 오차를 보고하므로, 한쪽으로 쏠리면 `scripts/narration.mjs` 의 상수를 고쳐라.

**단어 타임스탬프(`words[]`) 텍스트 일치율**은 별개 지표다 — 28줄 실측(2026-08-24)에서
whisper 토큰 수가 원문 어절 수와 정확히 같아 원문으로 치환된 줄은 **12/28 (43%)**, 나머지는
whisper 받아쓴 텍스트를 그대로 두고 경고했다. **타임스탬프 자체는 28줄 전부 확보됐다** —
정확한 캡션 텍스트가 필요하면 경고가 뜬 줄만 육안 확인하면 되고, 리빌 타이밍만 필요하면
경고를 무시해도 된다.

## 구조

```
plugins/script-to-motion/
├── .claude-plugin/plugin.json
├── skills/ko-video/SKILL.md        # /hyperframes 에 붙는 보조 레이어
├── references/
│   ├── korean-narration.md         # 발화 속도 · 조사 · 숫자 · 카피 예산
│   ├── korean-typography.md        # @font-face 폴백 · keep-all 줄바꿈
│   ├── korean-prompting.md         # 상류 프롬프트 스켈레톤에 얹는 한국어 델타
│   └── korean-technical-explainer.md  # 기술 설명 시각화 매핑표 + 참고 사이트 확인법
├── hooks/hooks.json                # SCRIPT.md 저장 시 자동 검사
└── scripts/                        # 의존성 0 (Node 내장 + piper/ffprobe/whisper 서브프로세스)
    ├── check-script.mjs            # 게이트 — 상류 산출물을 읽는다
    ├── ko-status.mjs               # 진행상태 안내 — 다음 실행 명령을 알려준다
    ├── ko-tts.mjs                  # Piper 어댑터 → audio_meta.json (whisper 단어 타임스탬프 자동 병합)
    ├── narration.mjs               # 한국어 발화 길이 추정
    ├── parse-plan.mjs              # SCRIPT.md / STORYBOARD.md 파서
    └── status.mjs                  # 진행상태 판별 — check-script.mjs · ko-status.mjs 공유
```

v0.6.0 까지 쓰던 Remotion 파이프라인과 예제는 `script-to-motion--v1.0.0` 태그에 동결되어 있다
(`git show script-to-motion--v1.0.0:<path>`). 현재 트리에는 없다.

## 라이선스

이 리포의 코드는 MIT (`LICENSE`). HyperFrames 는 Apache-2.0 으로 별도이며,
Piper 런타임은 GPL-3.0 이다 (서브프로세스 호출). 자세한 범위는 [`NOTICE.md`](NOTICE.md).
