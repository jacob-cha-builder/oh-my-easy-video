---
name: oh-my-easy-video
description: >
  한국어 나레이션이 들어가는 영상을 만들 때 쓴다. "영상 만들어줘", "설명영상",
  "소개영상", "이 깃헙/PR/발표자료/문서로 영상", "나레이션 넣어서", "자막 넣어서",
  "덱을 영상으로" 같은 요청이 한국어로 오면 여기서 시작한다 — 결과물 언어가 한국어면
  주제가 무엇이든(코드·제품·연구·사내공유) 해당한다.
  /hyperframes 의 plan → 초안(sketch) → 빌드 → 최종 4패스 리뷰 루프를 그대로 타고,
  한국어에서만 생기는 구멍을 메운다: 한국어 TTS(상류 Kokoro에 한국어 없음), 단어
  타임스탬프(나레이션↔애니메이션 순서 동기화), 발화 길이 검사, 용어 일관성, 한글 타이포.
  영어 등 다른 언어 영상이면 쓰지 않는다 — 그건 /hyperframes 가 직접 처리한다.
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

라우터가 run-shape 두 개를 물을 때:

- **`storyboard`** → **`yes`**. 이게 4패스 리뷰 루프를 켜는 스위치다. 여기만 챙기면 된다.
- **`flow`** → **사용자가 답하게 두라. 대신 답하지 마라.**

> ⚠️ `flow: companion` 은 **`/general-video` 로 고정**된다 (`brief-contract.md` §1). 그러면
> 라우터의 10행 라우팅 표가 통째로 죽어서 `/pr-to-video`·`/faceless-explainer`·
> `/product-launch-video`·`/motion-graphics` 같은 전용 워크플로가 절대 안 걸린다.
> `flow: automation` + `storyboard: yes` 도 똑같이 `mode: collaborative` 를 만들므로,
> **리뷰 루프를 켜려고 companion 을 고를 필요가 없다.** 사용자가 "같이 만들자"고 명시할
> 때만 companion 이다.

라우터가 어느 워크플로로 보내든 따라가라. 이 스킬은 그 워크플로 **안에서** 한국어 게이트만
끼워넣는다 — 워크플로를 대체하지 않는다.

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

## §2-1 빌드(3패스)할 때

**하나. 손으로 그리기 전에 이미 있는 걸 찾는다.**

```bash
npx hyperframes catalog | grep -i <찾는 것>     # 372개 블록·컴포넌트
npx hyperframes add <이름>
```

차트·카운트업·캡션·전환·다이어그램·리스트 리빌 — 대부분 이미 있다. 없다는 걸 **확인한
뒤에** 직접 만들어라.

**둘. 어느 도메인 스킬을 부를지는 라우터가 안다.** `hyperframes/SKILL.md` **§5 표**를 보라
(모션·색·미디어·오디오·구조·CLI·레지스트리 + creator-edit 조합 행까지 있다). 여기 옮겨
적지 않는다. 미리 다 부르지 말고 **그 순간 필요한 것만** 부른다.

**셋. 나레이션과 애니메이션 순서를 숫자로 맞춘다** — 아래 §2-2.

## §2-2 나레이션 ↔ 애니메이션 동기화 — 추측하지 말고 큐시트를 봐라

상류의 화면 리빌은 단어 타임스탬프에 의존한다 (*"the agent gets word timings for free"*).
한국어는 `ko-tts.mjs` 가 whisper 로 그걸 채워준다. **채워진 숫자를 눈으로 읽어 손으로 옮겨
적지 마라** — 오디오를 다시 만들면 전부 조용히 어긋난다.

**빌드 전 — 큐시트를 뽑는다:**

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cues.mjs" --project <dir>
```

프레임마다 단어별 **로컬**(프레임 컴포지션용)·**절대**(루트 오디오 배치용) 시각을 찍는다.
둘을 헷갈리는 게 흔한 실수다 — 프레임 안 타임라인은 0에서 시작한다.

리빌은 **그 내용을 말하는 단어의 시각**에 건다. 문장이 끝난 뒤가 아니라, 그 단어가 나오는
순간이다. 나레이션이 A→B→C 순서로 말하면 애니메이션도 A→B→C 여야 한다.

**빌드 후 — 실제로 맞았는지 검증한다:**

```bash
node ~/.claude/skills/hyperframes-animation/scripts/animation-map.mjs <dir> \
  --out <dir>/.hyperframes/anim-map
node "${CLAUDE_PLUGIN_ROOT}/scripts/cues.mjs" --project <dir> --check
```

실제로 도는 타임라인에서 트윈 시각을 뽑아 단어 경계와 대조하고, 0.4초 이상 떨어진 트윈을
찍어준다. 배경·앰비언트 모션이면 정상이고, **나레이션에 맞춰야 할 리빌이면 버그다.**

오디오를 다시 만들었으면(`ko-tts.mjs` 재실행) **반드시 다시 돌려라** — 길이가 바뀌면
기존 숫자가 전부 어긋난다. `check` 는 이걸 잡지 못한다.

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
| 나레이션에 리빌을 맞출 때 | §2-2 + `cues.mjs` — 큐시트와 드리프트 검증 |
| **영어 용어가 나올 때** | `references/korean-terminology.md` — 화면과 음성은 항상 일치해야 한다 |
| 사용자가 프롬프트를 쓸 때 | `references/korean-prompting.md` |
| 기술 설명(절차·아키텍처·수치)을 시각화할 때 | `references/korean-technical-explainer.md` |
| 컴포지션에 한글을 넣을 때 (§2 빌드 이후) | `references/korean-typography.md` |
| 발표자료를 원재료로 쓸 때 | `references/deck-ingest.md` |
| 검사 규칙 상세 | `references/gates.md` |
| 이 스킬이 왜 존재하는지 | `references/why.md` |
