# 보고자료 톤 모션 — 프리셋이 비워둔 칸

**프리셋은 모션을 정의하지 않는다.** `hyperframes-creative/frame-presets/blue-professional/FRAME.md`
는 색·타이포·레이아웃·금지사항을 빽빽하게 규정해놓고 마지막에 이렇게 끝난다:

> Composition + frame scale rewritten. **Motion out of scope.**

다른 프리셋도 같다. 그래서 프리셋을 제대로 골라도 모션은 무규율로 남고, **"해맑음"이
거기서 다시 샌다.** 색을 한 가지로 줄여놓고 요소가 통통 튀면 결국 발랄한 영상이다.

이 문서는 한국어 전용 규칙이 아니다 — 하지만 보고자료용 한국어 영상에서 가장 자주
깨지는 부분이라 여기 둔다.

## 수치 스펙

| 항목 | 보고자료 톤 | 흔히 새는 값 |
|---|---|---|
| 등장 시간 | **0.4–0.6s** | 0.15s 스냅 / 1.2s 둥실 |
| 이징 | **`power2.out` · `power1.out`** | `back.out` · `elastic` · `bounce` |
| 이동 거리 | **12–24px** | 60px+ 슬라이드 |
| 스케일 | **쓰지 않는다** (꼭 쓰면 0.98→1) | 0.9→1 팝 |
| 스태거 | **0.06–0.1s, 최대 5개** | 0.2s+ / 8개 이상 |
| 동시 모션 | **비트당 1개** | 3개가 같이 움직임 |
| 모션 후 정지 | **1.5초 이상** | 쉬지 않고 다음 모션 |
| 상시 배경 모션 | **금지** | 떠다니는 도형 · 글로우 펄스 · 패럴랙스 |

## 왜 이 두 개가 제일 중요한가

**"비트당 1개"와 "1.5초 정지".** 보고자료는 **읽는** 영상이다. 한국어 자막 한 문장을 읽는 데
2초 안팎이 걸리는데, 그 동안 화면이 계속 움직이면 읽기와 보기가 경쟁한다. 결과는 둘 다
실패다 — 문장도 못 읽고 그림도 못 본다.

`bounce`/`elastic` 금지도 같은 이유다. 되돌아오는 움직임(overshoot)은 시선을 한 번 더
끌어서, 이미 도착한 요소를 다시 보게 만든다.

## 무엇이 "상시 배경 모션"인가

한 번 나타나고 멈추는 것은 괜찮다. **멈추지 않는 것**이 문제다:

- 배경에서 천천히 도는 그라디언트·블롭
- 숨쉬듯 밝기가 변하는 글로우
- 스크롤/시간에 따라 계속 움직이는 패럴랙스 레이어
- 끝나지 않고 반복하는(`repeat: -1`) 모든 트윈

`blue-professional` 의 표현으로는 이렇게 정리된다:

> Reserve **atmosphere** (diagonal panel, dots, rings) for cover/closing;
> content frames keep the slide-header rhythm.

**장식은 표지와 마무리에만. 본문 프레임은 슬라이드 리듬을 지킨다.**

## 검증

### 1. 타임라인에서 뽑아보기

```bash
node ~/.claude/skills/hyperframes-animation/scripts/animation-map.mjs <dir> \
  --out <dir>/.hyperframes/anim-map
```

먼저 **어떤 필드가 들어있는지 확인한다** (버전에 따라 다르다):

```bash
python3 -c "import json;d=json.load(open('<dir>/.hyperframes/anim-map/animation-map.json'));print(list(d['tweens'][0].keys()))"
```

- `duration`·`ease` 가 있으면 → 위 표의 시간·이징을 그대로 대조한다.
- `start` 만 있으면 → **동시 모션 개수**(같은 시각에 시작하는 트윈)와 **정지 구간**
  (연속한 `start` 사이 간격)만 판정한다. 이 둘이 체감상 가장 큰 항목이라 그것만으로도 쓸 만하다.

`repeat: -1` 은 맵에 안 잡힐 수 있다 — 소스에서 직접 찾는 편이 확실하다:

```bash
grep -rn "repeat: *-1\|repeat:-1\|infinite" <dir>/compositions/
```

### 2. 정지 프레임 2장 비교 — 상시 모션 탐지

자동으로는 잘 안 잡힌다. 1초 간격으로 두 장 찍어서 **자막 말고 바뀐 게 있는지** 본다.

```bash
npx hyperframes snapshot --at 12.0 -o snapshots/
npx hyperframes snapshot --at 13.0 -o snapshots/
```

바뀐 게 있으면 배경이 돌고 있는 것이다. 그 씬에서 의도한 모션이 없는데 픽셀이 변했다면
지워야 할 대상이다.

### 3. 나레이션과 어긋나지 않는지

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cues.mjs" --project <dir> --check
```

리빌이 단어 경계에서 0.4초 이상 떨어져 있으면 나레이션과 무관하게 도는 모션이다
(`SKILL.md` §2-2).

## 의도적으로 어길 때

수치는 기본값이지 금지법이 아니다. 어겨야 할 장면(예: 데이터가 극적으로 무너지는 것을
보여주는 씬)이 있으면 **`STORYBOARD.md` 그 프레임에 한 줄로 이유를 남겨라.** 이유 없이
어긴 것과 구분되어야 다음 리뷰에서 다시 논쟁하지 않는다.

## 함께 볼 것

- `korean-captions.md` — 자막의 정적 처리 (단어 팝 제거는 이 문서의 "스케일 금지"와 같은 규칙)
- `korean-corporate-tone.md` — 프리셋·톤 결정 루프
- `SKILL.md` §2-2 — 나레이션↔애니메이션 동기화 (`cues.mjs`)
