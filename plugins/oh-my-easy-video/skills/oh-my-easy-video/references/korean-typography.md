# 한국어 타이포그래피 — 폰트 선언과 줄바꿈

HyperFrames 컴포지션에 한글을 넣을 때 **반드시** 하는 두 가지. 둘 다 실측으로 확인했고
(2026-08-22, `hyperframes@0.7.109`), 하나는 게이트가 잡지만 **다른 하나는 잡지 못한다.**

| # | 규칙 | 게이트가 잡는가 |
|---|---|---|
| 1 | 한글 폰트는 `@font-face` 선언이 필요하다 | ✔ `lint` 에러 |
| 2 | 본문에 `word-break: keep-all` 이 필요하다 | ✘ **눈으로만 보인다** |

## 1. 한글 폰트는 `@font-face` 를 선언해야 한다 — 안 하면 조용히 폴백

한글 폰트는 렌더러의 **자동 해석 목록에 없다.** `font-family` 로 이름만 적으면
렌더러가 공급하지 못하고 제네릭 폰트로 폴백해, 프리뷰와 렌더의 타이포그래피가 달라진다.

`lint` 가 에러로 잡는다:

```
✗ font_family_without_font_face: Font family used without @font-face declaration:
  apple sd gothic neo. These are not in the auto-resolved font list, so the renderer
  cannot supply them automatically. Text will fall back to a generic font, producing
  incorrect typography in the video.
```

**OS 번들 폰트는 파일이 없으므로 `src: local()` 을 쓴다.** 선언 자체만으로 검사를 만족한다 —
`.woff2` 파일이 필요 없다.

```css
@font-face { font-family: "Apple SD Gothic Neo"; src: local("AppleSDGothicNeo-Regular");  font-weight: 400; }
@font-face { font-family: "Apple SD Gothic Neo"; src: local("AppleSDGothicNeo-SemiBold"); font-weight: 600; }
@font-face { font-family: "Apple SD Gothic Neo"; src: local("AppleSDGothicNeo-Bold");     font-weight: 800; }

body { font-family: "Apple SD Gothic Neo", sans-serif; }
```

`local()` 안에는 **PostScript 이름**을 쓴다 (`AppleSDGothicNeo-Bold`), 표시 이름
(`Apple SD Gothic Neo Bold`) 이 아니다. `font-weight` 별로 따로 선언해야 굵기가 매핑된다.

> ⚠️ `local()` 은 **렌더하는 머신에 그 폰트가 깔려 있어야** 동작한다. CI 나 다른 OS 에서
> 렌더한다면 `.woff2` 를 프로젝트에 넣고 `src: url(...)` 로 가리켜라.
> 검사는 통과하는데 결과물만 다른 상황이 나올 수 있다.

| OS | 폰트 | PostScript 이름 |
|---|---|---|
| macOS | Apple SD Gothic Neo | `AppleSDGothicNeo-Regular` / `-SemiBold` / `-Bold` — 실측 확인 |
| Windows | 맑은 고딕 | 이 리포에서 검증한 적 없음. 아래 방법으로 직접 확인하라 |
| 크로스플랫폼 | Pretendard, Noto Sans KR | `.woff2` 를 넣고 `src: url(...)` — 가장 안전 |

이름을 모를 때 실제 설치된 값을 뽑는 법:

```bash
# macOS
system_profiler -xml SPFontsDataType | grep -A1 '_name' | grep -i gothic
# Windows (PowerShell)
[System.Drawing.Text.InstalledFontCollection]::new().Families | Where-Object Name -match '고딕|Gothic'
```

## 2. 본문에 `word-break: keep-all` — 없으면 단어 중간에서 끊긴다

CSS 기본값(`word-break: normal`)은 한글의 **모든 음절을 줄바꿈 지점으로 취급한다.**
한글에는 라틴어의 단어 경계 개념이 없어서, 줄이 어절 한가운데에서 잘린다.

`.head { max-width: 1380px; font-size: 92px }` 에 같은 문장을 넣고 찍은 실측:

```
word-break: normal            word-break: keep-all
─────────────────────────     ─────────────────────────
AI로 만든 영상은, 두 번째 컷에서 무너      AI로 만든 영상은, 두 번째 컷에서
집니다.                        무너집니다.
```

`normal` 은 **"무너집니다"라는 한 단어를 "무너" / "집니다" 로 쪼갰다.** 어간이 끊긴 것이라
읽는 사람이 순간 멈춘다. 조사(`은`/`를`/`에서`)가 홀로 떨어지는 경우도 같은 원인이다.

```css
.head, .cap, .body { word-break: keep-all; }
```

`keep-all` 은 **공백에서만** 끊는다. 그래서 한 어절이 통째로 다음 줄로 간다.

> ⚠️ **`npm run check` 는 이것을 잡지 못한다.** 위 깨진 버전으로 실행하면
> `0 error(s)` 로 통과하고 Layout·Motion·Contrast 도 전부 통과한다.
> `word-break` 는 오버플로우도 겹침도 만들지 않아 어떤 게이트에도 걸리지 않는다.
> **반드시 `snapshot` 을 찍어 눈으로 봐라.**

```bash
# 줄바꿈이 걱정되는 헤드라인만 확대해서 찍는다
npx hyperframes snapshot --at <초> --no-end --zoom ".head" -o snapshots/
```

`keep-all` 은 한 어절이 컨테이너보다 길면 오버플로우시킨다 (한글에서는 드물지만
긴 영문 URL·식별자가 섞이면 발생). 그 경우 그 요소에만 `overflow-wrap: anywhere` 를 더한다.

## 함께 볼 것

- `korean-narration.md` — 발화 길이 추정, 조사 강조 규칙, 화면비별 카피 예산.
  **카피 예산을 지키는 것이 줄바꿈 문제를 애초에 줄이는 가장 확실한 방법이다**
  (16:9 = 7단어/32자, 9:16 = 5단어/20자, 1:1 = 6단어/26자).
