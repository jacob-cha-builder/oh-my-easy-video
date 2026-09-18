// 한국어 TTS 런타임 설치. 멱등 — 다시 돌려도 안전하다.
//
//   node setup.mjs                 # 기본 위치에 Piper 설치 (기본 엔진)
//   node setup.mjs --engine melo   # MeloTTS 설치 (상업적 용도 가능 — 아래 "엔진 선택" 참고)
//   node setup.mjs --dir <path>    # 설치 위치를 바꾼다
//   node setup.mjs --python python3.12   # 쓸 파이썬을 직접 지정 (아래 ⚠ 참고)
//   node setup.mjs --print-env     # 이미 설치돼 있을 때 export 두 줄만 다시 본다 (Piper 전용)
//
// ⚠ 설치 성공 = 합성 성공이 아니다. piper 는 설치가 멀쩡해도 0바이트 wav 를 만들고
//   종료코드 0 으로 끝나는 실패 모드가 있다(대표적으로 설치 경로가 길 때 — §2 참고).
//   그래서 이 스크립트는 마지막에 실제로 한 문장을 합성해보고 wav 크기를 확인한다.
//
// 설치되는 것 (--engine piper, 기본값):
//   1. 파이썬 venv + piper-tts        → ~/.cache/oh-my-easy-video/venv
//   2. 한국어 음성 모델 (63MB, 2파일) → ~/.cache/oh-my-easy-video/voices
//
// 설치되는 것 (--engine melo):
//   1. 파이썬 venv + MeloTTS          → ~/.cache/oh-my-easy-video/venv-melo
//   2. 한국어 체크포인트는 최초 합성 시 MeloTTS 가 자동으로 받는다 (HuggingFace 캐시)
//
// 둘 다 사용자 레벨에 둔다. 프로젝트마다 다시 받지 않기 위해서다.
//
// 엔진 선택 — Piper vs MeloTTS:
//   Piper 의 한국어 음성(ko_KR-kss-medium)은 CC BY-NC-SA 4.0 이라 상업적 용도로 못 쓴다.
//   여성 단일 화자뿐이고, ko-tts.mjs 가 쓴다 — 검증된 기본 경로, 가볍고 빠르다.
//   MeloTTS 는 상업적 용도가 가능한 라이선스이고 melo-tts.mjs 가 쓴다 — 대신 설치가
//   무겁다(PyTorch) 그리고 narration.mjs 의 5.5음절/초 추정 상수(Piper 로 보정됨)보다
//   느리게 읽는다(실측 평균 18~20% 과소추정 — korean-narration.md 참고). 둘 다 설치해도
//   되고(venv 가 분리돼 있다), 프로젝트마다 다른 엔진을 골라도 된다 — BRIEF.md 에 적어두면
//   나중에 다시 알아볼 필요가 없다.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, renameSync, unlinkSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = {};
for (let i = 0; i < process.argv.length - 2; i++) {
  const a = process.argv[i + 2];
  if (a?.startsWith('--')) args[a.slice(2)] = process.argv[i + 3]?.startsWith('--') ? true : process.argv[i + 3] ?? true;
}

const ROOT = args.dir && args.dir !== true ? String(args.dir) : join(homedir(), '.cache', 'oh-my-easy-video');
const ENGINE = args.engine && args.engine !== true ? String(args.engine) : 'piper';

if (ENGINE !== 'piper' && ENGINE !== 'melo') {
  console.error(`✘ 알 수 없는 --engine "${ENGINE}" — piper 또는 melo 만 지원합니다.`);
  process.exit(1);
}

if (ENGINE === 'melo') {
  setupMelo(ROOT);
  process.exit(0);
}

const VENV = join(ROOT, 'venv');
const VOICES = join(ROOT, 'voices');
const PY = join(VENV, 'bin', 'python');

// GitHub 릴리즈가 게시하는 다이제스트. 받은 파일이 이것과 다르면 쓰지 않는다.
const RELEASE = 'https://github.com/jacob-cha-builder/oh-my-easy-video/releases/download/voices--v1';
const ASSETS = [
  { name: 'ko_KR-kss-medium.onnx', sha256: '624fd774e26895f24bebae1bd9a3379e3394baeade4b584924f83e414096e2c9' },
  { name: 'ko_KR-kss-medium.onnx.json', sha256: '153b5619d0580f824a59108d83ca19434de410eb8e4fe80325b58684fdc8a1df' },
];

const VOICE = join(VOICES, ASSETS[0].name);
const say = (s) => console.log(s);
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: 'inherit', ...opts });
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

const envLines = () => `export PIPER_PYTHON="${PY}"\nexport PIPER_VOICE="${VOICE}"`;

if (args['print-env']) {
  say(envLines());
  process.exit(0);
}

say(`설치 위치: ${ROOT}\n`);
mkdirSync(VOICES, { recursive: true });

// ── 1. 음성 모델 ────────────────────────────────────────────────────────────
// piper 보다 먼저 받는다 — §2 의 합성 스모크 테스트가 이 파일을 쓴다.
for (const asset of ASSETS) {
  const dest = join(VOICES, asset.name);

  if (existsSync(dest)) {
    if (sha256(dest) === asset.sha256) {
      say(`✓ ${asset.name} — 이미 있음 (체크섬 일치)`);
      continue;
    }
    say(`· ${asset.name} — 체크섬 불일치, 다시 받습니다`);
  }

  say(`· ${asset.name} 내려받는 중…`);
  const tmp = `${dest}.part`;
  try {
    run('curl', ['-fL', '--progress-bar', '-o', tmp, `${RELEASE}/${asset.name}`]);
  } catch {
    if (existsSync(tmp)) unlinkSync(tmp);
    console.error(`✘ ${asset.name} 다운로드 실패. 네트워크를 확인하고 다시 실행하세요.`);
    process.exit(1);
  }

  const got = sha256(tmp);
  if (got !== asset.sha256) {
    unlinkSync(tmp);
    console.error(`✘ ${asset.name} 체크섬 불일치 — 받은 파일을 버렸습니다.\n  기대: ${asset.sha256}\n  실제: ${got}`);
    process.exit(1);
  }
  renameSync(tmp, dest);
  say(`✓ ${asset.name} — 검증 완료`);
}

// ── 2. 파이썬 venv + piper-tts ──────────────────────────────────────────────
//
// ⚠ `--help` 통과를 설치 성공으로 믿으면 안 된다. piper 는 설치가 멀쩡해도
// **0바이트 wav 를 만들면서 종료코드 0 으로 끝나는** 실패 모드가 있다. 그러면
// 사용자는 "설치 완료" 를 보고 나서 한참 뒤 무음 영상에서야 눈치챈다.
// 그래서 여기서는 실제로 한 문장을 합성해보고 wav 크기를 확인한다.
//
// 알려진 원인 하나 — **설치 경로가 길면 깨진다.** piper 가 번들 espeak-ng 에
// 데이터 경로를 넘기는데(`piper/phonemize_espeak.py`: `_DIR / "espeak-ng-data"`),
// espeak-ng 의 경로 버퍼가 고정 크기(160자)라 긴 경로는 중간에서 잘린다.
// 실측 2026-09-18: `~/.cache/oh-my-easy-video`(95자) → 114KB wav ✔ /
// 175자 경로 → 0바이트, 에러는 잘린 경로를 가리킨다(`.../site-packages/pip/phontab`).
// 파이썬 버전은 무관하다 (3.9.6 · 3.14.7 둘 다 짧은 경로에서 정상).

const ESPEAK_PATH_LIMIT = 160;

/** 실제로 합성이 되는가. 0바이트 wav 를 걸러내는 것이 이 함수의 존재 이유다. */
const synthWorks = () => {
  const probe = join(ROOT, '.probe.wav');
  try {
    execFileSync(PY, ['-m', 'piper', '-m', VOICE, '-f', probe], {
      input: '안녕하세요. 설치 확인용 문장입니다.',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return existsSync(probe) && statSync(probe).size > 1000;
  } catch {
    return false;
  } finally {
    if (existsSync(probe)) unlinkSync(probe);
  }
};

/** espeak 데이터 경로가 버퍼에 들어가는지 — 설치 전에 미리 잡는다. */
const espeakPathLen = () => {
  const libs = join(VENV, 'lib');
  const pyDir = existsSync(libs) ? (readdirSync(libs).find((d) => d.startsWith('python')) ?? 'python3.x') : 'python3.x';
  return join(VENV, 'lib', pyDir, 'site-packages', 'piper', 'espeak-ng-data', 'phontab').length;
};

const pyVersion = (py) => {
  try {
    return execFileSync(py, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return '?';
  }
};

const basePy = args.python && args.python !== true ? String(args.python) : 'python3';

if (existsSync(PY) && synthWorks()) {
  say(`✓ piper — 이미 설치됨 (${pyVersion(PY)}, 합성 확인됨)`);
} else {
  if (existsSync(PY)) say('· venv 는 있는데 합성이 안 됩니다. 다시 만듭니다');

  if (espeakPathLen() > ESPEAK_PATH_LIMIT) {
    console.error(
      `✘ 설치 경로가 너무 깁니다 (${espeakPathLen()}자 > ${ESPEAK_PATH_LIMIT}자 한계).\n` +
        `  piper 가 쓰는 espeak-ng 는 경로 버퍼가 고정이라, 긴 경로에서는 설치가 "성공" 해도\n` +
        `  합성이 0바이트로 나옵니다.\n\n` +
        `  현재: ${ROOT}\n` +
        `  더 짧은 경로로 설치하세요:  node setup.mjs --dir ~/.cache/oh-my-easy-video`,
    );
    process.exit(1);
  }

  try {
    execFileSync(basePy, ['--version'], { stdio: 'pipe' });
  } catch {
    console.error(`✘ ${basePy} 를 찾을 수 없습니다.\n  macOS: brew install python3`);
    process.exit(1);
  }

  if (existsSync(VENV)) rmSync(VENV, { recursive: true, force: true });
  say(`· 파이썬 venv 생성 중… (${basePy}, ${pyVersion(basePy)})`);
  run(basePy, ['-m', 'venv', VENV]);
  say('· piper-tts 설치 중… (몇 분 걸립니다)');
  run(PY, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
  run(PY, ['-m', 'pip', 'install', '--quiet', 'piper-tts']);

  if (!synthWorks()) {
    console.error(
      `\n✘ piper 설치는 됐는데 실제 합성이 되지 않습니다 (0바이트 wav).\n` +
        `  파이썬: ${pyVersion(basePy)}\n` +
        `  espeak 데이터 경로 길이: ${espeakPathLen()}자 (한계 ${ESPEAK_PATH_LIMIT}자)\n\n` +
        `  해볼 것:\n` +
        `    1. 더 짧은 경로:  node setup.mjs --dir ~/.cache/oh-my-easy-video\n` +
        `    2. 다른 파이썬:   node setup.mjs --python python3.12\n` +
        `    3. MeloTTS 로 우회: node setup.mjs --engine melo`,
    );
    process.exit(1);
  }
  say(`✓ piper 설치 완료 (${pyVersion(basePy)}, 합성 확인됨)`);
}

// ── 3. env ─────────────────────────────────────────────────────────────────
const envPath = join(ROOT, 'tts-env.sh');
writeFileSync(envPath, `# oh-my-easy-video — 한국어 TTS 환경\n# 다시 만들려면: node setup.mjs\n${envLines()}\n`);

say(`
설치 완료.

  source ${envPath}

또는 셸 설정에 직접 넣으세요:

${envLines()}

⚠ 음성 모델(ko_KR-kss-medium)은 CC BY-NC-SA 4.0 입니다 — 상업적 용도로 쓸 수 없습니다.`);

// ── MeloTTS 엔진 ─────────────────────────────────────────────────────────────
//
// MeloTTS(myshell-ai)는 import 시점에 모든 언어 백엔드를 무조건 불러온다
// (melo/text/cleaner.py: `from . import chinese, japanese, ...`), 그리고 일본어
// 모듈이 최상단에서 MeCab.Tagger() 를 생성한다 — 한국어만 쓰더라도 일본어 MeCab
// 바인딩(mecab-python3)이 import 가능해야 한다는 뜻이다. 그런데 macOS/Windows 의
// 대소문자 구분 없는 파일시스템에서는 mecab-python3 가 설치하는 `MeCab/` 디렉터리와
// python-mecab-ko(실제 한국어 형태소 분석에 필요)가 설치하는 `mecab/` 디렉터리가
// 같은 항목으로 병합돼 서로의 파일을 덮어쓴다 — 두 패키지를 어떤 순서로 설치해도
// 한쪽이 깨진다. 해결책: mecab-python3 를 아예 빼고(한국어 전용이면 실제로 필요
// 없다), melo/text/japanese.py 의 `import MeCab` 을 실패해도 통과하도록 패치한다.
function setupMelo(root) {
  const venv = join(root, 'venv-melo');
  const py = join(venv, 'bin', 'python');
  const say = (s) => console.log(s);
  const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: 'inherit', ...opts });

  say(`설치 위치 (MeloTTS): ${root}\n`);

  // 이미 동작하는지 확인 — g2pkk 의 한국어 mecab 경로까지 실제로 태운다.
  // (단순 `import melo` 만으로는 이 문제를 못 잡는다: 모듈 자체는 import 가능해도
  // 실제 합성 시점에 g2pkk 가 mecab 을 못 찾아 NoneType.pos 로 죽을 수 있다.)
  const SMOKE_TEST = "from melo.text.cleaner import clean_text; clean_text('안녕하세요', 'KR'); print('OK')";
  if (existsSync(py)) {
    try {
      const out = execFileSync(py, ['-c', SMOKE_TEST], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (out.includes('OK')) {
        say('✓ MeloTTS — 이미 설치됨 (한국어 경로 확인됨)');
        printMeloDone(py);
        return;
      }
    } catch {
      say('· venv 는 있는데 MeloTTS 한국어 경로가 깨져 있습니다. 다시 설치합니다');
    }
  }

  // Piper 와 달리 MeloTTS 가 최신 파이썬에서 깨진다는 실측은 아직 없다 — 기본은 python3
  // 그대로 두고, 아래 스모크 테스트가 실패하면 --python 으로 바꿔 끼울 수 있게만 열어둔다.
  const basePy = args.python && args.python !== true ? String(args.python) : 'python3';
  try {
    execFileSync(basePy, ['--version'], { stdio: 'pipe' });
  } catch {
    console.error(`✘ ${basePy} 를 찾을 수 없습니다.\n  macOS: brew install python3`);
    process.exit(1);
  }

  if (!existsSync(py)) {
    say(`· 파이썬 venv 생성 중… (${basePy})`);
    run(basePy, ['-m', 'venv', venv]);
  }

  // site-packages 경로 — python 버전에 의존하지 않는 방법으로 찾는다.
  const sitePackages = execFileSync(
    py, ['-c', 'import sysconfig; print(sysconfig.get_paths()["purelib"])'], { encoding: 'utf8' },
  ).trim();

  say('· MeloTTS 설치 중… (PyTorch 포함 — 몇 분, 수백MB~수GB 걸립니다)');
  run(py, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
  run(py, ['-m', 'pip', 'install', 'git+https://github.com/myshell-ai/MeloTTS.git']);

  say('· unidic 사전 받는 중… (일본어 백엔드의 import 요구사항 — 실제로 쓰이진 않는다)');
  run(py, ['-m', 'unidic', 'download']);

  say('· mecab-python3(일본어) 를 제거하고 python-mecab-ko(한국어) 를 깨끗이 재설치합니다…');
  try {
    run(py, ['-m', 'pip', 'uninstall', '-y', 'mecab-python3'], { stdio: 'pipe' });
  } catch {
    // 애초에 없었으면 그냥 넘어간다.
  }
  // 대소문자 구분 없는 파일시스템에서 병합된 잔재를 청소한다 — site-packages 안으로만 한정.
  const mecabDir = join(sitePackages, 'MeCab');
  if (existsSync(mecabDir)) rmSync(mecabDir, { recursive: true, force: true });
  for (const entry of readdirSync(sitePackages)) {
    if (entry.startsWith('_mecab') && entry.endsWith('.so')) {
      rmSync(join(sitePackages, entry), { force: true });
    }
  }
  run(py, ['-m', 'pip', 'install', '--force-reinstall', '--no-deps', 'python-mecab-ko'], { stdio: 'pipe' });

  say('· melo/text/japanese.py 패치 중 (MeCab 없이도 import 되게)…');
  patchMeloJapanese(py);

  say('· 확인 중…');
  try {
    const out = execFileSync(py, ['-c', SMOKE_TEST], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!out.includes('OK')) throw new Error('smoke test did not print OK');
    say('✓ MeloTTS 설치 완료 (한국어 경로 확인됨)');
  } catch (e) {
    console.error(
      `✘ MeloTTS 는 설치됐지만 한국어 경로 확인에 실패했습니다: ${e.message}\n` +
        `  파이썬 버전 문제일 수 있습니다 (현재 ${basePy}). 다른 버전으로 시도해보세요:\n` +
        `    node setup.mjs --engine melo --python python3.12`,
    );
    process.exit(1);
  }

  printMeloDone(py);
}

function patchMeloJapanese(py) {
  const meloDir = execFileSync(
    py, ['-c', 'import melo, os; print(os.path.dirname(melo.__file__))'], { encoding: 'utf8' },
  ).trim();
  const jaFile = join(meloDir, 'text', 'japanese.py');
  if (!existsSync(jaFile)) {
    console.error(`✘ ${jaFile} 를 찾을 수 없습니다 — MeloTTS 버전이 바뀌어 경로가 달라졌을 수 있습니다.`);
    process.exit(1);
  }
  let src = readFileSync(jaFile, 'utf8');
  if (src.includes('MeCab = None')) {
    return; // 이미 패치됨 (재설치를 거쳐도 이 파일은 그대로 남는 경우가 있다)
  }
  const importBlock = 'try:\n    import MeCab\nexcept ImportError as e:\n    raise ImportError("Japanese requires mecab-python3 and unidic-lite.") from e';
  const patchedImport =
    'try:\n    import MeCab\nexcept ImportError:\n' +
    '    # oh-my-easy-video: Korean-only install — mecab-python3 (Japanese) and\n' +
    '    # python-mecab-ko (Korean) collide on a case-insensitive filesystem, so\n' +
    '    # this install intentionally omits mecab-python3. Tolerate its absence\n' +
    '    # instead of hard-failing melo.text.cleaner\'s eager `from . import japanese`.\n' +
    '    MeCab = None';
  if (!src.includes(importBlock)) {
    console.error(`✘ ${jaFile} 의 import 블록이 예상과 달라 자동 패치할 수 없습니다 — MeloTTS 버전을 확인하세요.\n  수동 패치: import MeCab 를 try/except 로 감싸고 실패 시 MeCab = None 으로 두세요.`);
    process.exit(1);
  }
  src = src.replace(importBlock, patchedImport);
  src = src.replace('_TAGGER = MeCab.Tagger()', '_TAGGER = MeCab.Tagger() if MeCab is not None else None');
  writeFileSync(jaFile, src);
}

function printMeloDone(py) {
  console.log(`
설치 완료.

  MELO_PYTHON="${py}"

melo-tts.mjs 는 위 경로를 기본값으로 찾으므로 보통 아무 것도 안 해도 된다.
다른 venv 를 쓰려면 --melo-python 플래그나 MELO_PYTHON 환경변수로 지정하라.

한국어 체크포인트는 melo-tts.mjs 를 처음 돌릴 때 자동으로 받는다(HuggingFace 캐시,
~/.cache/huggingface). MIT 라이선스(코드·한국어 체크포인트 myshell-ai/MeloTTS-Korean 모두 확인됨) — Piper 의 음성 모델과 달리 상업적 용도로
쓸 수 있다.`);
}
