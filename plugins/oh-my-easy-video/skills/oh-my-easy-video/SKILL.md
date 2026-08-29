---
name: oh-my-easy-video
description: 한국어 나레이션 설명 영상을 만든다. /hyperframes 의 plan → 초안 → 빌드 → 최종 4패스 리뷰 루프를 그대로 타면서, 한국어에서만 생기는 구멍(TTS·단어 타임스탬프·발화 길이·용어 일관성·타이포그래피)을 메운다. 발표자료(PDF/이미지 덱)로 만들 때도 이 스킬을 쓴다. 한국어 영상 요청이면 무조건 여기서 시작.
---

# oh-my-easy-video

**이 스킬은 파이프라인을 소유하지 않는다.** 인터뷰·스토리보드·리뷰·비주얼·렌더는 전부
`/hyperframes` 와 그 워크플로가 owner 다. 여기가 하는 일은 두 가지뿐이다 —
**(1) 그 루프에 반드시 진입시키는 것**, **(2) 한국어 게이트를 끼워넣는 것.**

막히면 언제든:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs" --project <dir>
```

이 명령이 다음에 뭘 할지 알려준다. 그 지시를 건너뛰지 마라.

## §0 라우팅

| 사용자가 준 것 | 할 일 |
|---|---|
| 발표자료 (PDF / 슬라이드 이미지 폴더) | `references/deck-ingest.md` 를 읽고 §0-덱 절차 먼저, 그다음 §1 |
| 그 외 (주제·글·자료 몇 장·URL) | 바로 §1 |
| 한국어가 아님 | 비켜선다. 상류 `/hyperframes` 로 그냥 보내라 |

## §1 먼저 `/hyperframes` 를 부른다 — 선택 아님

**첫 행동은 `Skill(hyperframes)` 호출이다.** 인터뷰를 직접 흉내내지 마라. `BRIEF.md` 없이
`STORYBOARD.md` 를 쓰기 시작했다면 이미 틀렸다 — `status.mjs` 가 `no-brief` 로 막는다.

라우터가 run-shape 두 개를 물으면 이렇게 답한다:

- `flow: companion`
- `storyboard: yes`

→ `mode: collaborative` 가 도출된다. 이게 4패스 리뷰 루프를 켜는 스위치다.

`[negatives]` 에 **`ko-tts`** 를 반드시 넣어라. 안 넣으면 기본 Kokoro TTS 경로로 흘러가는데
거기엔 한국어가 없다.

## §2 4패스 리뷰 루프 — 새로 만들지 말고 그대로 탄다

전체 메커니즘은 `hyperframes-core/references/review-loop.md` 에 이미 정의돼 있다.
**여기 다시 쓰지 않는다. 그 문서를 읽고 그대로 따라라.** 요약만:

| 패스 | 하는 일 | 프레임 `status:` | 끝에서 |
|---|---|---|---|
| 1 plan | 프레임 표를 제안 | `outline` | 보드에서 승인받고 대기 |
| 2 초안(sketch) | 프레임마다 **와이어프레임**만 — 진짜 문구, 판때기, 모션 없음 | `built` | 레이아웃 확정받고 대기 |
| 3 빌드 | 확정된 레이아웃에 디자인·모션을 입힌다 (레이아웃은 다시 그리지 않는다) | `animated` | — |
| 4 최종 | 완성본 프리뷰 | — | 렌더 승인받기 |

**반드시 지킬 것:**

1. **§2 초안 패스를 건너뛰지 마라.** `outline` 에서 바로 완성 애니메이션으로 가는 게
   가장 흔한 실패다. 초안은 파일당 수십 줄, 보드 전체가 몇 분이면 찬다. 여기서 CLI를
   돌리지 마라 — `snapshot`/`check`/`lint` 전부 불필요하다.
2. **`status:` 필드를 실제 진행에 맞게 갱신하라.** 안 바꾸면 완성된 프레임도 보드에
   "Not built yet" 으로 뜬다.
3. **보드는 새로고침해야 갱신된다.** 해시(`#`)만 바뀌는 내비게이션으로는 안 된다.
4. **보드 제출은 에이전트에게 알림을 주지 않는다.** 사용자에게 *"코멘트 남기고 채팅으로
   한 마디 주세요"* 라고 말해줘야 한다. 이걸 안 알려주면 루프가 멈춘 것처럼 보인다.
5. 코멘트는 `.hyperframes/frame-comments.json` 으로 들어온다. 체크포인트에서 사용자
   답이 오면 **채팅보다 이 파일을 먼저 읽어라.** 거기 이름 붙은 프레임만 고치고,
   **파일을 지운 뒤** 다시 보여준다.

보드 띄우기:

```bash
npx hyperframes preview --background     # 이 세션이 죽어도 살아남는다
```

`npm run dev` 를 백그라운드로 감싸지 마라 — 세션과 함께 죽는다.

## §3 한국어 게이트 — 오디오 앞뒤로 두 번

`SCRIPT.md` + `STORYBOARD.md` 가 승인되면:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project <dir>   # ① 추정 검사
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs"       --project <dir>   # ② TTS + 단어 타임스탬프
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project <dir>   # ③ 실측 재검사
```

- **① 이 exit 1 이면 오디오를 만들지 마라.** 대본 고치는 게 오디오 다시 만드는 것보다 싸다.
- **③ 을 건너뛰지 마라.** 추정이 통과해도 실측에서 걸린다 (실제 사례: 추정 3.96초 통과 →
  실측 4.08초, 여백 0.42초 < 0.45초 실패).
- 처음이거나 `piper` / 음성 모델이 없다고 실패하면:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.mjs"
  ```
  파이썬 venv · piper · 한국어 음성 모델(63MB)을 받아 검증하고 export 두 줄을 찍어준다.
  멱등하니 다시 돌려도 안전하다.

검사 규칙 7종의 상세는 `references/gates.md`.

## §4 참조 — 필요할 때만 읽는다

| 언제 | 읽을 것 |
|---|---|
| 대본 문장을 쓸 때 | `references/korean-narration.md` — 발화 속도, 조사, 숫자, 카피 예산 |
| **영어 용어가 나올 때** | `references/korean-terminology.md` — 화면과 음성은 항상 일치해야 한다 |
| 사용자가 프롬프트를 쓸 때 | `references/korean-prompting.md` |
| 기술 설명(절차·아키텍처·수치)을 시각화할 때 | `references/korean-technical-explainer.md` |
| 컴포지션에 한글을 넣을 때 (§2 빌드 이후) | `references/korean-typography.md` |
| 발표자료를 원재료로 쓸 때 | `references/deck-ingest.md` |
| 검사 규칙 상세 | `references/gates.md` |
| 이 스킬이 왜 존재하는지 | `references/why.md` |
