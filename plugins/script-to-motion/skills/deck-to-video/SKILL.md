---
name: deck-to-video
description: 기존 발표자료(PDF 또는 이미지로 내보낸 덱)를 HyperFrames 나레이션 영상으로 만든다. 슬라이드를 인제스트하고, 사용자와 짧은 인터뷰로 목적·분량·톤을 확정한 뒤, 비주얼보다 먼저 SCRIPT.md 를 완성해 리뷰받고, 그다음 STORYBOARD.md 를 역산한다. 이후 단계는 ko-video 의 한국어 게이트와 /general-video 를 그대로 물려받는다.
---

# deck-to-video — 발표자료 기반 HyperFrames 영상

**이 스킬은 Step 0~4(덱 인제스트 → 인터뷰 → 스크립트 → 스토리보드)만 담당한다.**
한국어 대본 검사·TTS 는 `ko-video` 를 그대로 쓰고, 실제 컴포지션(HTML/GSAP) 빌드는
`/general-video` 가 owner 다. 여기서 새로 하는 일은 **"이미 있는 발표자료를 원재료로
스크립트·스토리보드를 만드는 것"** 뿐이다.

## 언제 쓰는가

"이 PPT로 영상 만들어줘", "발표자료 기반으로 설명영상", "이 덱을 영상으로" 같은 요청.
사용자가 이미 슬라이드(PDF로 내보낸 덱, 또는 PNG/JPG 스크린샷 폴더)를 갖고 있다는 게 전제다.
슬라이드 없이 텍스트/브리프만 있으면 이 스킬이 아니라 `/faceless-explainer` 로 가라.

## 파이프라인

```
0. deck-to-slides.mjs   덱(PDF/이미지) → deck/slides/slide-01.png ...
1. 슬라이드 훑어보기      에이전트가 슬라이드별로 조용히 분류 (재디자인 vs 스크린샷 유지)
2. 인터뷰                덱 내용에 근거해 목적·분량·톤·강조/생략을 확정 → BRIEF.md
3. SCRIPT.md 먼저        슬라이드별 나레이션 문장을 확정하고 사용자 리뷰를 받는다 (비주얼 전에)
4. STORYBOARD.md         승인된 나레이션 길이로 슬롯을 역산, 프레임별 visual_source 태그
        │
   ── 여기서부터 ko-video 게이트 (기존, 무수정) ──
        │
5. check-script.mjs     추정 기반 사전 검사
6. ko-tts.mjs            한국어 TTS
7. check-script.mjs     실측 기반 재검사
        │
   ── /general-video 로 인계 (비주얼 빌드) ──
```

**순서를 지켜라.** 인터뷰가 끝났다고 바로 스토리보드나 비주얼로 가지 마라. 나레이션 문장이
슬롯 길이를 결정하므로(`references/korean-narration.md`), 순서를 뒤집으면 비주얼을 다시
만들어야 한다.

---

## 0. 덱 인제스트

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/deck-to-slides.mjs" --project videos/<name> --source <deck.pdf 또는 이미지 폴더>
```

PDF 는 poppler(`pdftoppm`)로 200dpi PNG 로 래스터화한다. 이미지 폴더는 파일명 순서대로
`slide-01.png`... 로 정규화한다. `deck/manifest.json` 에 슬라이드 수·치수를 기록한다.

> PPTX/Keynote 파일을 직접 파싱하지는 않는다. **PowerPoint/Keynote/Google Slides 모두
> "PDF로 내보내기"** 한 뒤 그 PDF를 `--source` 로 넘기면 된다.

사전 준비 (한 번만): `brew install poppler` (macOS) — 이미 있으면 건너뛴다.

## 1. 슬라이드 분류 — 조용히, 사용자에게 묻지 않는다

`deck/slides/slide-NN.png` 를 한 장씩 읽고 판단한다:

| 슬라이드 내용 | `visual_source` | 처리 |
|---|---|---|
| 제목+불릿뿐, 표·차트·스크린샷 없음 | `redesign` | HyperFrames 타이포그래피·모션으로 새로 만든다 |
| 차트·스크린샷·다이어그램·사진 있음 | `screenshot` | 원본 이미지를 크롭해 장면 배경으로 쓰고 카메라 무브로 생기를 준다 (`product-launch-video` 가 웹사이트 스크린샷을 쓰는 방식과 동일) |

이 판단은 **사용자에게 묻지 않는다.** 인터뷰는 슬라이드별 비주얼 처리가 아니라 영상
전체의 목적·톤을 정하는 데 쓴다.

## 2. 인터뷰 — 스크립트를 쓰기 전에 확정한다

일반론적 질문("어떤 영상을 원하세요?")이 아니라 **덱에서 실제로 본 내용에 근거해서** 물어라.
후보를 먼저 제시하고 확인받는 형태가 좋다 (예: "톤이 investor 피치처럼 보이는데, 맞나요?").

물어야 할 것:
- **목적/오디언스** — investor 용, 팀 내부 공유, 퍼블릭 공개 중 무엇인가
- **분량** — 전체 N장을 다 다룰지, 핵심 M장만 추릴지. **장수가 많으면(6장 이상) 반드시
  물어라** — 전부 다루면 나레이션이 과해져 게이트에서 계속 걸린다
- **톤** — 차분한 설명 vs 하이에너지
- **강조/생략** — 특정 슬라이드를 스킵하거나 순서를 바꿀지
- **엔딩** — CTA/마무리 문구가 있는지

답을 `BRIEF.md` 에 적는다 (Message / Audience / Arc / Mood — `hyperframes-core` 의 브리프
계약을 그대로 따른다).

## 3. SCRIPT.md 먼저 — 비주얼보다 먼저 확정하고 리뷰받는다

슬라이드마다 나레이션 블록 하나. 규칙은 `references/korean-narration.md` 그대로:

- 나레이션은 **읽는 대로**, 화면 카피는 **숫자 그대로**
  (`narration: "열네 가지"` / `copy: "14가지"`)
- 강조 구간에 조사를 포함시켜라 (`"3시간을"`, `"3시간"` 아님 — 안 그러면 검사 규칙 4가 걸린다)
- 한 슬라이드 = 기본 한 문장. 두 문장을 넣으면 마침표 정지(0.32초)가 추가로 붙는다
- 라틴 약어(`AI` 등)는 실측보다 짧게 추정된다 — 섞였으면 `korean-narration.md` 의 오차
  사례를 참고해 보수적으로 잡아라

`SCRIPT.md` 를 쓴 뒤 **STORYBOARD.md 를 쓰기 전에** 사용자에게 보여주고 승인을 받아라.
슬라이드가 많으면 한 번에 다 보여주지 말고 3~4장 단위로 끊어 리뷰받는 것도 방법이다.

## 4. STORYBOARD.md — 승인된 스크립트에서 슬롯 길이를 역산

`scripts/narration.mjs` 의 `suggestDuration()` 으로 슬라이드별 나레이션 추정 시간 + 여백
(0.45~2.2초)을 계산해 프레임 `duration` 을 채운다. 프레임마다:

```yaml
- n: <슬라이드 번호>
  title: <한 문장 클레임 — 라벨이 아니라 완전한 주장문, storyboards.mdx 규칙>
  duration: <suggestDuration 결과>
  type: hook | benefit_highlight | social_proof | cta   # storyboards.mdx 참고
  persuasion: <수사 장치>
  beat: <감정 비트>
  focal: <시선이 가는 지점>
  visual_source: redesign | screenshot   # 1단계 분류 결과
```

`visual_source: screenshot` 인 프레임은 `deck/slides/slide-NN.png` 경로를 메모해 다음
단계(비주얼 빌드)가 찾을 수 있게 한다.

---

## 게이트 — 여기서부터는 `ko-video` 그대로

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project videos/<name>
node "${CLAUDE_PLUGIN_ROOT}/scripts/ko-tts.mjs" --project videos/<name>
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-script.mjs" --project videos/<name>
```

수정 없이 그대로 쓴다 — `SCRIPT.md`/`STORYBOARD.md` 포맷이 같기 때문이다. 자세한 규칙은
`skills/ko-video/SKILL.md`.

## 비주얼 빌드 — `/general-video` 에 인계

실제 컴포지션(HTML/GSAP) 빌드는 이 스킬의 범위가 아니다. `/general-video`(companion) 를
불러 프레임별로:

- `visual_source: screenshot` → `deck/slides/slide-NN.png` 를 장면 배경으로 크롭하고
  카메라 무브(푸시인/팬)로 정적 스크린샷에 생기를 준다
- `visual_source: redesign` → 추출한 텍스트만 갖고 `hyperframes-creative`/
  `hyperframes-animation` 규칙으로 타이포그래피·모션을 새로 설계한다

**`/slideshow` 는 쓰지 마라.** 출력이 mp4 가 아니라 클릭으로 넘기는 인터랙티브 덱이고,
`render` 는 첫 슬라이드만 남기고 조용히 잘린다 (상류 `docs/guides/slideshow.mdx` 경고).
이 스킬의 목표는 발표자료를 원재료로 한 **나레이션 있는 mp4** 다.

## 발표자료가 아니면

이 스킬은 비켜선다. 텍스트/브리프만 있으면 `/faceless-explainer`, 이미 대본이 있으면
`ko-video` 로 바로 가라.

## 함께 볼 것

- `skills/ko-video/SKILL.md` — 한국어 게이트(추정·TTS·재검사)
- `references/korean-narration.md` — 발화 속도, 조사, 숫자, 카피 예산
- `references/korean-prompting.md` — 상류 프롬프트 스켈레톤에 얹는 한국어 델타
