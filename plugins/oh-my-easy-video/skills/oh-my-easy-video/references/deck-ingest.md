# 발표자료를 원재료로 쓸 때

이미 있는 덱(PDF 또는 슬라이드 이미지 폴더)이 원재료일 때의 절차. `SKILL.md` §0 에서
여기로 온다. **§1(`/hyperframes` 호출) 앞에 붙는 준비 단계**이지 대체가 아니다.

## 0. 덱 인제스트

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/deck-to-slides.mjs" --project <dir> --source <deck.pdf | 이미지 폴더>
```

PDF 는 poppler(`pdftoppm`)로 200dpi PNG 로 래스터화한다. 이미지 폴더는 파일명 순서대로
`slide-01.png`... 로 정규화한다. `deck/manifest.json` 에 슬라이드 수·치수를 기록한다.

> PPTX/Keynote 를 직접 파싱하지는 않는다. **PowerPoint/Keynote/Google Slides 모두
> "PDF로 내보내기"** 한 뒤 그 PDF를 `--source` 로 넘겨라.

사전 준비: `brew install poppler` (macOS). 이미 있으면 건너뛴다.

## 1. 슬라이드 분류 — 조용히, 사용자에게 묻지 않는다

`deck/slides/slide-NN.png` 를 한 장씩 읽고 판단한다:

| 슬라이드 내용 | `visual_source` | 처리 |
|---|---|---|
| 제목+불릿뿐, 표·차트·스크린샷 없음 | `redesign` | 타이포그래피·모션으로 새로 만든다 |
| 차트·스크린샷·다이어그램·사진 있음 | `screenshot` | 원본을 크롭해 장면 배경으로 쓰고 카메라 무브로 생기를 준다 |

**이 판단은 사용자에게 묻지 않는다.** §1 인터뷰는 슬라이드별 비주얼 처리가 아니라 영상
전체의 목적·톤을 정하는 데 쓴다.

## 2. `/hyperframes` 인터뷰에 덱 내용을 실어 보낸다

`SKILL.md` §1 로 간다. 다만 일반론적 질문이 아니라 **덱에서 실제로 본 내용에 근거해서**
후보를 제시하고 확인받는 형태가 좋다 (예: "톤이 investor 피치처럼 보이는데 맞나요?").

라우터가 안 물어도 이 넷은 확정하고 넘어가라:

- **목적/오디언스** — investor 용, 팀 내부 공유, 퍼블릭 공개
- **분량** — 전체 N장을 다 다룰지, 핵심 M장만 추릴지.
  **6장 이상이면 반드시 물어라** — 전부 다루면 나레이션이 과해져 게이트에서 계속 걸린다
- **강조/생략** — 특정 슬라이드를 스킵하거나 순서를 바꿀지
- **엔딩** — CTA/마무리 문구가 있는지

## 3. 프레임에 `visual_source` 를 실어둔다

리뷰 루프 §1(plan)에서 프레임 표를 만들 때 1단계 분류 결과를 같이 적는다:

```yaml
- n: <슬라이드 번호>
  title: <한 문장 클레임 — 라벨이 아니라 완전한 주장문>
  duration: <narration.mjs suggestDuration 결과>
  visual_source: redesign | screenshot
```

`screenshot` 인 프레임은 `deck/slides/slide-NN.png` 경로를 메모해 빌드 패스가 찾을 수
있게 한다. 초안(§2) 패스에서는 그 이미지 자리에 **판때기만** 놓는다 — 실제 이미지는
빌드 패스에서 들어간다.

## 하지 말 것

**`/slideshow` 를 쓰지 마라.** 출력이 mp4 가 아니라 클릭으로 넘기는 인터랙티브 덱이고,
`render` 는 첫 슬라이드만 남기고 조용히 잘린다 (상류 `docs/guides/slideshow.mdx` 경고).
목표는 발표자료를 원재료로 한 **나레이션 있는 mp4** 다.

## 덱이 아니면

텍스트/브리프만 있으면 이 문서는 건너뛰고 `SKILL.md` §1 로 바로 가라.
