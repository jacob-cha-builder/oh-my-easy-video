# 한국어 기술 설명 시각화 가이드

**새 시각화 프리미티브를 만들지 않는다.** `/hyperframes-registry`(176종)와
`/hyperframes-animation` 카탈로그가 이미 있다. 이 문서는 "기술적인 내용을 설명해야 할 때
그중 뭘 고를지"와 "고르기 전에 실제 사례를 어떻게 확인할지"만 다룬다.

상류에 "기술 설명" 전용 워크플로는 없다 — 가장 가까운 건 `/faceless-explainer`(주제 설명,
시각은 전부 창작)다. 아래 표는 그 위에서 자주 쓰는 조합을 정리한 것뿐이고, 실제 사용법
(파라미터, 클래스명)은 그 블록의 카탈로그 문서(`/catalog/blocks/<name>` 또는
`/catalog/components/<name>`)로 위임한다.

## 매핑표 (2026-08-24 `llms.txt` 대조 완료 — 블록명 실재 확인)

| 기술 설명 상황 | 상류 블록/패턴 | 한국어 주의사항 |
|---|---|---|
| 절차·순서 설명 | `flowchart`, `flowchart-vertical` | 노드 라벨 짧게 — `korean-narration.md` 화면 카피 상한 재사용 |
| 아키텍처·구성요소 관계 | `constellation-hub` | 노드 이름에 `word-break: keep-all` 필수 |
| 코드 동작 설명 | `code-typing`, `code-diff`, `code-morph`, `code-highlight`(Sweep), `code-3d-extrude` | 코드 자체는 원문 유지, 주석만 한국어면 폰트 폴백 확인 |
| 수치·성능 비교 | `data-chart`, `animated-bar-chart`, `bar-chart-race`, `decline-chart`, `count-up`, `chart-story` | 숫자는 `narration.mjs` 자릿수 확장 규칙과 자연스럽게 맞물림(이미 구현됨) |
| 지리·분포 설명 | `world-map`, `us-map` 계열 | 지역명 한글 표기 시 `@font-face` 필수 |
| 상태 변화·비교(before/after) | `before-after-wipe`, `comparison-split`, `grade-split-reveal` | 좌우 라벨 길이 대칭 유지 — 한국어는 조사 때문에 비대칭 나기 쉬움 |
| 단계별 진행·강조 | `state-chip-rail`, `conic-progress-ring`, `telemetry-hud` | 칩 라벨은 명사형으로 — 조사 붙이면 잘림 |

**8패턴 한정이다.** 안 맞으면 `/hyperframes-registry` 카탈로그를 직접 검색하라 — 이 표를
전체 카탈로그의 대체물로 쓰지 마라.

## 프롬프트에 녹이는 법

`prompting/anatomy.md` 의 6요소 스켈레톤(`[route][spec][beats][copy][technique][negatives]`)을
그대로 쓰되, `[technique]` 에 위 표의 블록명을 정확히 채운다:

```
[route]      /faceless-explainer
[technique]  `flowchart` 레지스트리 블록을 적용해 3단계 절차로 재구성
[copy]       각 노드는 한 어절 이내로 — "요청 수신" / "검증" / "응답 반환"
[negatives]  영어 라벨 금지, 이모지 금지
```

## 실제 사례 확인하기

디자인 방향이 안 잡혔거나, 고른 패턴이 실제로 어떻게 보이는지 확인하고 싶으면
**claude-in-chrome**으로 참고 사이트를 직접 방문한다. 상류에는 이런 기능이 없다 —
`prompting/recreating-references.md`는 "이미 가진 참고 자료(스크린샷·영상)를 프레임 단위로
분석하는 법"만 다루고, 참고 자료를 **찾으러 나가는** 것 자체는 다루지 않는다. 이 스킬이
Claude Code 세션에 이미 있는 브라우저 자동화로 그 앞단을 메운다.

1. `claude-in-chrome` 스킬을 부른다.
2. 사용자가 참고 사이트를 지정했으면 그곳으로, 안 지정했으면
   [`hyperframes.heygen.com/examples`](https://hyperframes.heygen.com/examples)부터 본다 —
   HyperFrames 자체 프로덕션 사례 갤러리라 "이 프레임워크로 실제로 만들 수 있는 것"의
   상한선을 보여준다(실측 확인함: "Product & launch films", "The tooling, shown working",
   "Motion, sound & effects" 세 그룹으로 나뉘어 있고, 데이터/코드 시각화 사례도 있다).
3. 스크린샷을 찍는다 (`computer` 액션 `screenshot`, 필요하면 `zoom`으로 특정 영역 확대).
4. `prompting/recreating-references.md` 의 프레임 단위 분석(색상·레이아웃·모션 단서 적기)을
   그 스크린샷에 적용해, `[technique]`/`[style]` 슬롯에 옮겨 담는다.
5. 참고 사이트가 한국어가 아니면 — 라벨/카피 길이만 그대로 가져오지 말고
   `korean-narration.md` 의 화면 카피 상한으로 다시 계산한다. 영어 라벨이 짧다고 한국어도
   짧게 나온다는 보장이 없다(조사·어미 때문에 보통 더 길어진다).

**주의**: 특정 사이트를 "정답"으로 못 박지 않는다 — 위 예시(HyperFrames 자체 갤러리)는
안전한 기본값일 뿐, 사용자가 다른 참고를 주면 그쪽을 우선한다.

## 참고 소스

- `https://hyperframes.heygen.com/prompting/anatomy.md` — 6요소 스켈레톤
- `https://hyperframes.heygen.com/prompting/recreating-references.md` — 프레임 단위 분석 기법
- `https://hyperframes.heygen.com/llms.txt` — 블록명 대조용 전체 카탈로그 인덱스
- `../korean-narration.md`, `../korean-typography.md` — 위 표의 한국어 주의사항 근거
