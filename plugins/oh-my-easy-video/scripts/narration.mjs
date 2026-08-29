// 나레이션 길이 추정. 의존성 0.
// P1 에서 대본만 보고 씬 길이를 정하기 위한 것이고,
// P4 에서 실제 TTS 를 생성한 뒤 실측값으로 보정한다 (reconcile-tts.mjs).

/**
 * 발화 속도 상수.
 * 한국어는 음절, 라틴 문자권은 단어 기준이 자연스럽다.
 * 150 words/60s (설명영상 표준) = 2.5 words/sec.
 * 한국어 5.5음절/초는 차분한 나레이션 기준 — 첫 TTS 실측 후 보정하라.
 */
export const RATE = {
  hangulSyllablesPerSec: 5.5,
  latinWordsPerSec: 2.5,
  /** 쉼표·마침표에서 생기는 자연스러운 멈춤 */
  pauseComma: 0.15,
  pauseSentence: 0.32,
};

/** 씬 길이는 나레이션보다 최소 이만큼 길어야 한다 (호흡·전환 여백) */
export const PAD = { min: 0.45, max: 2.2 };

const HANGUL = /[가-힣]/g;
const LATIN_WORD = /[A-Za-z][A-Za-z'’-]*/g;
const DIGITS = /\d+/g;

/**
 * 숫자는 읽으면 길어진다. "1200" → "천이백" ≈ 3음절.
 * 자릿수당 대략 1.2음절로 근사한다.
 */
const digitSyllables = (text) => {
  let n = 0;
  for (const m of text.match(DIGITS) ?? []) n += Math.ceil(m.length * 1.2);
  return n;
};

/** 나레이션 한 줄의 발화 시간(초)을 추정한다. */
export const estimateSec = (text, rate = RATE) => {
  if (!text || !text.trim()) return 0;

  const hangul = (text.match(HANGUL) ?? []).length;
  const latinWords = (text.match(LATIN_WORD) ?? []).length;
  const digits = digitSyllables(text);

  const commas = (text.match(/[,、·]/g) ?? []).length;
  const sentences = (text.match(/[.!?。？！]/g) ?? []).length;

  const sec =
    (hangul + digits) / rate.hangulSyllablesPerSec +
    latinWords / rate.latinWordsPerSec +
    commas * rate.pauseComma +
    sentences * rate.pauseSentence;

  return Math.round(sec * 100) / 100;
};

/**
 * 추정 발화 시간에 여백을 더한 권장 씬 길이.
 * durationSec × fps 는 정수여야 하므로(규칙 4) 프레임 단위로 올림한다.
 * 초 값이 순환소수가 될 수 있어 프레임 수를 함께 돌려준다.
 */
export const suggestDuration = (text, fps, rate = RATE) => {
  const frames = Math.ceil((estimateSec(text, rate) + PAD.min) * fps);
  return { frames, sec: frames / fps };
};

/** 순환소수를 그대로 뿌리지 않기 위한 표시용 포맷 */
export const fmtDuration = ({ frames, sec }) =>
  `${Number(sec.toFixed(4))}초 (${frames}프레임)`;
