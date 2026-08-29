# 한국어 프롬프트 — 상류 스켈레톤에 얹는 델타

**상류 프롬프팅 문서를 먼저 읽어라.** 이 문서는 그것을 대체하지 않는다.
프롬프트 해부, 스펙 밀도, 모션 8원칙, 레지스트리 블록 지정법은 전부 상류가 owner 다.

| 경로 | |
|---|---|
| 웹 | <https://hyperframes.heygen.com/prompting/overview> |
| 오프라인 | `~/.claude/plugins/marketplaces/hyperframes/docs/prompting/*.mdx` (32개) |

> `npx hyperframes docs` 는 프롬프팅 토픽을 서빙하지 **않는다**
> (`data-attributes` / `gsap` / `compositions` / `rendering` / `examples` / `troubleshooting` 뿐).
> 오프라인으로 읽으려면 위 마켓플레이스 클론 경로를 직접 열어라.

여기서는 **한국어 나레이션 영상에서만 달라지는 것**만 적는다.

---

## 상류 6부 스켈레톤 — 한국어에서 바뀌는 슬롯

상류 `anatomy.mdx` 의 골격:

```
[route]      /motion-graphics
[spec]       8-second 1920x1080 video.
[beats]      Beat 1 (0-4s): ...  Beat 2 (4-5s): ...  Beat 3 (5-8s): ...
[copy]       the exact on-screen text, quoted
[technique]  Adapt the `code-typing` and `vfx-shatter` registry blocks.
[negatives]  No narration, no image or media files.
```

| 슬롯 | 한국어 델타 |
|---|---|
| `[route]` | 그대로. 단 "**한국어 나레이션**"을 명시해야 `oh-my-easy-video` 레이어가 붙는다 |
| `[spec]` | **역전된다** — 길이를 선언하지 말고 대본에서 도출한다 (↓ 아래) |
| `[beats]` | 그대로 |
| `[copy]` | **두 필드로 쪼갠다** — 화면 카피와 나레이션은 다른 텍스트다 (↓ 아래) |
| `[technique]` | 그대로. 단 블록 안의 한글에 `@font-face` + `keep-all` 필요 → `korean-typography.md` |
| `[negatives]` | **`ko-tts` 지정이 필수다** — 기본 경로는 한국어를 못 읽는다 (↓ 아래) |

---

## `[spec]` — 길이를 선언하면 안 된다

상류는 `8-second 1920x1080 video` 처럼 길이를 **선언**한다. 영어권 작성자는 wpm 감각으로
대본이 그 안에 들어가는지 짐작할 수 있기 때문이다.

**한국어는 그 감각이 없다.** "20초 숏폼"이라고 선언하고 30초짜리 한국어 대본을 쓰면
오디오를 만든 **뒤에야** 알게 된다. 그래서 순서를 뒤집는다:

```
나레이션 문장을 확정 → check-script.mjs 가 슬롯 길이를 계산 → 그 합이 영상 길이
```

프롬프트에는 길이 대신 **분량 예산**을 준다.

| 목표 길이 | 씬 수 | 실제 발화 | 한글 예산 | 씬당 |
|---|---|---|---|---|
| 15초 | 3 | 12.9초 | **61음절** | 20 |
| 20초 | 4 | 17.2초 | **82음절** | 20 |
| 30초 | 5 | 26.5초 | **127음절** | 25 |
| 60초 | 8 | 54.4초 | **261음절** | 32 |
| 90초 | 12 | 81.6초 | **391음절** | 32 |

> ⚠️ **여기 쓰인 값은 4.8음절/초이지 `narration.mjs` 의 5.5 가 아니다.**
> 5.5 는 순수 발화 속도고, 실제 대본에는 마침표(+0.32초)·쉼표(+0.15초) 정지와
> 라틴 약어가 섞인다. 5.5 로 역산하면 예산을 **15% 과다 계상**해서 대본을 쓴 뒤
> 게이트에서 걸린다. 4.8 은 `videos/ko-explainer` 실측(118음절 / 발화 24.6초)에서
> 나온 값이고, 같은 프로젝트에 되먹여 검증했다 — 예측 119음절 vs 실제 118, **오차 0.8%**.
>
> 이 표는 **계획용 근사**다. 확정은 언제나 `check-script.mjs` 다.

감각 잡는 기준 — 한 문장이 대략 이 정도다:

```
"AI로 만든 영상은, 두 번째 컷에서 무너집니다."          17음절 → 3.96초 → 슬롯 4.43초
"대본을 먼저 쓰고, 기계가 검사한 다음에야 코드를 만듭니다."   24음절 → 4.83초 → 슬롯 5.30초
```

**한 씬 = 한 문장**이 기본이다. 두 문장을 넣으면 마침표 정지(0.32초)가 추가로 붙는다.

---

## `[copy]` — 화면 텍스트와 나레이션은 다른 텍스트다

상류는 `[copy]` 하나다. 한국어는 **둘로 쪼개야** 추정이 맞는다.

```
copy:       "14가지 검사"        ← 화면. 아라비아 숫자 그대로
narration:  "검사는 열네 가지입니다."  ← 읽는 대로. 추정기가 이걸 센다
```

`"14"` 를 그대로 세면 2음절인데 실제 발화는 "열네" 다. 나레이션에 읽는 대로 써야
추정 오차가 실측 대비 2% 안에 들어온다.

**강조 구간에는 조사를 포함시켜라.** `"3시간"` 이 아니라 `"3시간을"` — 안 그러면 잔여
텍스트가 `"을 잃고 있습니다"` 로 시작한다. 검사 규칙 4 가 이걸 실패로 잡는다.

**화면 카피 상한** (화면비별, `korean-narration.md`):

| 화면비 | 단어 | 글자 |
|---|---|---|
| 16:9 | 7 | 32 |
| 9:16 | 5 | 20 |
| 1:1 | 6 | 26 |

세로형에 가로형 기준으로 쓰면 반드시 과밀해진다. **카피 예산을 지키는 것이 줄바꿈 사고를
애초에 없애는 가장 확실한 방법이다.**

---

## `[negatives]` — 기본 TTS 경로를 반드시 막아라

상류 `media-and-audio.mdx`:

> "Otherwise the local **Kokoro** model runs, and it needs no API key."

**Kokoro-82M 에 한국어가 없다** (9개 언어 — 미/영 영어, 일본어, 중국어, 스페인·프랑스·
힌디·이탈리아·포르투갈어). 막지 않으면 기본 경로로 흘러가 잘못된 발음이 나오거나 실패한다.

```
[negatives]  Kokoro TTS 쓰지 마라 — 한국어 미지원.
             오디오는 ko-tts.mjs (Piper ko_KR-kss-medium) 로 만들어라.
```

> Piper 한국어 음성은 `kss/medium` **하나뿐**이다 — 여성 단일 화자, CC BY-NC-SA 4.0
> (상업적 용도 불가). 남성 음성이나 화자 변경을 프롬프트에 쓰면 이 경로로는 만족시킬 수
> 없다 — 화자를 바꾸려면 HeyGen 로그인이 있어야 한다. **상업적 용도**가 필요하면 화자는
> 그대로(역시 단일 화자)지만 라이선스가 더 자유로운 MeloTTS 로 바꿔라 —
> `[negatives]` 를 `ko-tts.mjs (Piper) 대신 melo-tts.mjs (MeloTTS) 로 만들어라`로
> 바꿔 쓰면 된다 (`node setup.mjs --engine melo` 최초 1회 필요). 상세: `korean-narration.md`.

---

## 스펙 밀도 — 나레이션만은 다이얼이 없다

상류 `specification-dial.mdx` 는 세 단계를 제시한다: **mood words** → **style tokens**
→ **full visual spec**. *"Spec density controls how far the result drifts from what you
imagined — not whether it works."*

**한국어 나레이션에는 이 다이얼이 적용되지 않는다.** 비주얼은 무드 워드로 맡겨도 되지만
**나레이션 텍스트는 언제나 최대 밀도** — 최종 문장 그대로여야 한다.

이유: 추정기가 그 문자열을 세서 슬롯 길이를 정한다. "도입부에서 문제를 제기하는 톤"
같은 서술은 셀 수 없다. 에이전트가 지어낸 문장으로 슬롯이 잡히면, 나중에 문장을 고칠 때
길이가 통째로 어긋난다.

| 슬롯 | 다이얼 가능? |
|---|---|
| 비주얼·컬러·모션 | ✔ 무드 워드로 충분 |
| 화면 카피 | △ 예산 안에서만 |
| **나레이션 문장** | ✘ **항상 최종 문장 그대로** |

---

## 붙여넣어 쓰는 템플릿

```
/hyperframes 한국어 나레이션 영상을 만든다.

[route]      <워크플로>          예: /faceless-explainer, /motion-graphics
[spec]       <화면비> · 한글 <N>음절 예산 (위 표에서 목표 길이로 역산)
             ※ 영상 길이는 선언하지 않는다 — check-script.mjs 가 대본에서 도출한다
[beats]      씬 1: <무엇이 어떻게 움직이는가>
             씬 2: ...
[copy]       씬 1 화면: "<예산 안의 카피>"
             씬 1 나레이션: "<최종 문장 그대로. 숫자는 읽는 대로.>"
             씬 2 화면: "..."
             씬 2 나레이션: "..."
[technique]  <레지스트리 블록 이름> 을 각색.
             한글 텍스트에는 @font-face { src: local(...) } 와 word-break: keep-all 필수
[negatives]  Kokoro TTS 쓰지 마라 (한국어 미지원) — ko-tts.mjs 를 써라.
             <그 외 금지사항>

순서를 지켜라: 대본 → check-script → ko-tts → check-script 재실행 → 비주얼.
검사가 exit 1 이면 오디오로 넘어가지 마라. 렌더는 내 승인 후에만.
```

### 채워진 예 (`videos/ko-explainer` 재구성)

```
/hyperframes 한국어 나레이션 영상을 만든다.

[route]      /faceless-explainer
[spec]       16:9 · 한글 약 120음절 예산 (4씬)   → 실제로 118음절 / 27.6초로 나왔다
[beats]      씬 1: 헤드라인이 아래에서 밀려 올라오고 강조어가 붉게 스탬프
             씬 2: 타임라인 바 두 개가 자라며 하나가 씬 슬롯 경계를 넘어간다.
                   그 아래 고스트 자막에서 실제 자막이 오른쪽으로 밀린다
             씬 3: 순서가 뒤집히는 것을 좌→우 플로우로
             씬 4: 검사 항목이 스태거로 찍힌다
[copy]       씬 1 화면: "두 번째 컷에서 무너진다"
             씬 1 나레이션: "AI로 만든 영상은, 두 번째 컷에서 무너집니다."
             씬 2 화면: "+1.4s 초과"
             씬 2 나레이션: "길이가 어긋나고 자막이 밀립니다.
                            대본 없이 코드부터 썼기 때문입니다."
[technique]  타임라인 바는 하드 어서링. 배경은 풀블리드 자식 div 에 (루트에 두면 렌더가 검게 나온다)
[negatives]  Kokoro TTS 쓰지 마라 — ko-tts.mjs (Piper ko_KR-kss-medium).
             이미지·영상 파일 없음
```

---

## 반복할 때

상류가 owner 다 — `docs/prompting/iterating.mdx` 와
`/hyperframes-core` → `references/review-loop.md` (특히 §4 *"Render only on approval"*).
한국어에서 하나만 더:

**나레이션 문장을 고치면 슬롯 길이가 바뀐다.** 문구만 다듬어도 `check-script.mjs` 를
다시 돌려라. 훅이 `SCRIPT.md` / `STORYBOARD.md` 저장 시 자동으로 돌리지만,
`index.html` 의 `data-duration` 은 **자동으로 따라오지 않는다** — 직접 맞춰야 한다.

**추정이 통과해도 실측에서 걸릴 수 있다.** 실제 사례: 추정 3.96초로 통과 → Piper 실측
4.08초 → 여백 0.42초 < 0.45초로 실패. 그래서 ko-tts 전후로 두 번 돌린다.

## 함께 볼 것

- `korean-narration.md` — 발화 속도 상수, 조사 규칙, 숫자 읽기, 카피 예산
- `korean-typography.md` — `@font-face` 폴백, `keep-all` 줄바꿈 (게이트가 못 잡는다)
