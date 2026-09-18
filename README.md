# oh-my-easy-video

한국어로 설명 영상을 만드는 Claude Code 플러그인.
[HyperFrames](https://hyperframes.heygen.com) 위에 얹는 **한국어 레이어**다.

```
"이 깃헙 내용으로 2분짜리 설명영상 만들어줘"
        ↓
  /hyperframes 인터뷰        ← 무엇을, 누구에게, 어떤 톤으로
        ↓
  ① plan     프레임 표를 보드에서 승인
  ② 초안     와이어프레임만 올리고 레이아웃 확정      ← 여기서 코멘트
  ③ 빌드     확정된 레이아웃에 디자인·모션
  ④ 최종     완성본 보고 렌더 승인                   ← 여기서 또 코멘트
        ↓
      mp4
```

각 패스마다 Studio 보드에서 프레임별로 코멘트를 달고, 그게 반영된 다음 패스로 넘어간다.

## 설치

```bash
# 1. HyperFrames 본체 (이 플러그인이 의존한다)
claude plugin marketplace add heygen-com/hyperframes --scope local

# 2. 한국어 레이어
claude plugin marketplace add jacob-cha-builder/oh-my-easy-video --scope local
claude plugin install oh-my-easy-video@oh-my-easy-video --scope local
```

Claude Code 를 재시작한 뒤 한국어 영상 요청을 하면 스킬이 붙는다.

> 1번이 먼저다. 마켓플레이스 간 의존성은 자동 해결되지 않아서, 없으면
> `Is the "hyperframes" marketplace added?` 로 실패한다.

### 한국어 TTS 준비 (한 번만)

Claude Code 안에서 **"한국어 TTS 설치해줘"** 라고 하면 스킬이 알아서 돌린다
(스킬은 `${CLAUDE_PLUGIN_ROOT}` 로 경로를 안다). 셸에서 직접 돌리려면 — 설치 경로에
버전이 끼어 있으니 글롭으로 잡는 게 편하다:

```bash
node ~/.claude/plugins/cache/oh-my-easy-video/oh-my-easy-video/*/scripts/setup.mjs
```

파이썬 venv · piper · 한국어 음성 모델(63MB)을 `~/.cache/oh-my-easy-video/` 에 설치하고
체크섬까지 검증한다. 멱등하니 다시 돌려도 안전하다. 설치 후에는 환경변수 없이도 동작한다.

**상업적 용도**가 필요하면 Piper 음성 대신 MeloTTS 를 쓴다(`--engine melo`) — 음성은
여전히 한국어 화자 하나뿐이지만 라이선스가 더 자유롭다:

```bash
node ~/.claude/plugins/cache/oh-my-easy-video/oh-my-easy-video/*/scripts/setup.mjs --engine melo
```

PyTorch 를 포함하는 별도 venv(`venv-melo`)라 처음엔 몇 분 걸린다. 자세한 트레이드오프는
[`references/gates.md`](plugins/oh-my-easy-video/skills/oh-my-easy-video/references/gates.md).

## 왜 한국어 레이어가 필요한가

| | 문제 | 이 플러그인이 하는 일 |
|---|---|---|
| 1 | HyperFrames 번들 TTS(Kokoro)에 **한국어가 없다** (9개 언어, 한국어 제외) | Piper 로 로컬 합성 |
| 2 | 나레이션 길이를 **추정할 감각이 한국어엔 전이되지 않는다** (영어 wpm 기준) | 오디오 전 추정 검사 + 후 실측 재검사 |
| 3 | 화면 리빌 타이밍이 **단어 타임스탬프에 의존**하는데 Piper 는 안 준다 | whisper 로 `words[]` 채움 |

파이프라인 자체는 전부 `/hyperframes` 소관이다. 이 플러그인은 그 루프에 **진입시키고**,
한국어 구멍만 메운다. 자세한 근거는
[`references/why.md`](plugins/oh-my-easy-video/skills/oh-my-easy-video/references/why.md).

## 구조

```
plugins/oh-my-easy-video/
  skills/oh-my-easy-video/
    SKILL.md                    ← 진입점. 4패스 루프로 라우팅
    references/
      korean-narration.md         발화 속도, 조사, 숫자, 카피 예산
      korean-terminology.md       화면과 음성은 항상 일치한다
      korean-typography.md        @font-face, word-break: keep-all
      korean-prompting.md         상류 프롬프트에 얹는 한국어 델타
      korean-technical-explainer.md  기술 설명 시각화 매핑
      korean-captions.md          자막은 문장 단위 · 카라오케 금지
      korean-report-motion.md     보고자료 톤 모션 수치 (프리셋이 안 덮는 칸)
      korean-corporate-tone.md    회사 보고자료 톤 결정 루프
      deck-ingest.md              발표자료를 원재료로 쓸 때
      gates.md                    검사 규칙 7종 + 자막 4종 + TTS 상세
      why.md                      근거
  scripts/
    setup.mjs        TTS 런타임 설치 (멱등, --engine piper|melo)
    status.mjs       진행상태 → 다음 할 일
    check-script.mjs 대본 검사 7종
    check-captions.mjs 자막 검사 4종 (문장 단위 · 카라오케 잔존)
    ko-tts.mjs       한국어 TTS(Piper) + 단어 타임스탬프
    melo-tts.mjs     한국어 TTS(MeloTTS, 상업적 용도, 기본 --speed 1.2) + 단어 타임스탬프 — ko-tts.mjs 대체
    melo_synth.py    melo-tts.mjs 의 합성 단계 (MeloTTS 파이썬 API 호출)
    narration.mjs    발화 길이 추정 (Piper 기준 — MeloTTS 는 korean-narration.md 참고)
    parse-plan.mjs   SCRIPT.md / STORYBOARD.md 파서
    deck-to-slides.mjs  PDF/이미지 → 슬라이드 PNG
  hooks/hooks.json   SCRIPT.md/STORYBOARD.md · 캡션 HTML 저장 시 자동 검사
```

## 자주 막히는 곳

| 증상 | 원인 | 해결 |
|---|---|---|
| 보드에 "Not built yet" 만 뜬다 | `STORYBOARD.md` 의 `status:` 를 안 바꿈 | `outline` → `built` → `animated` 로 갱신 |
| 보드를 고쳐도 화면이 그대로 | 해시(`#`)만 바뀌는 내비게이션 | 브라우저 **완전 새로고침** |
| 코멘트를 남겼는데 반응이 없다 | 보드 제출은 에이전트에게 알림을 주지 않는다 | 채팅으로 한 마디 보내기 |
| 나레이션이 영어를 못 읽는다 | Piper 한국어 음성은 라틴문자를 못 읽음 | 한국어 용어로 (`korean-terminology.md`) |
| 한글이 단어 중간에서 끊긴다 | `word-break: keep-all` 누락 | `check` 가 못 잡는다 — 스냅샷으로 눈 확인 |

## 라이선스

플러그인 코드는 MIT. **Piper 음성 모델(`ko_KR-kss-medium`)은 CC BY-NC-SA 4.0 —
상업적 용도로 쓸 수 없다.** 상업적 용도가 필요하면 `melo-tts.mjs`(MeloTTS, 코드·모델 모두 MIT)를
쓴다. [`NOTICE.md`](NOTICE.md) 참고.
