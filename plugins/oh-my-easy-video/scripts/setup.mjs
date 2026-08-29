// 한국어 TTS 런타임 설치. 멱등 — 다시 돌려도 안전하다.
//
//   node setup.mjs                 # 기본 위치에 설치
//   node setup.mjs --dir <path>    # 음성 모델을 다른 곳에 둔다
//   node setup.mjs --print-env     # 이미 설치돼 있을 때 export 두 줄만 다시 본다
//
// 설치되는 것:
//   1. 파이썬 venv + piper-tts        → ~/.cache/oh-my-easy-video/venv
//   2. 한국어 음성 모델 (63MB, 2파일) → ~/.cache/oh-my-easy-video/voices
//
// 둘 다 사용자 레벨에 둔다. 프로젝트마다 63MB 를 다시 받지 않기 위해서다.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = {};
for (let i = 0; i < process.argv.length - 2; i++) {
  const a = process.argv[i + 2];
  if (a?.startsWith('--')) args[a.slice(2)] = process.argv[i + 3]?.startsWith('--') ? true : process.argv[i + 3] ?? true;
}

const ROOT = args.dir && args.dir !== true ? String(args.dir) : join(homedir(), '.cache', 'oh-my-easy-video');
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

// ── 1. 파이썬 venv + piper-tts ──────────────────────────────────────────────
let piperOk = false;
if (existsSync(PY)) {
  try {
    execFileSync(PY, ['-m', 'piper', '--help'], { stdio: 'pipe' });
    piperOk = true;
    say('✓ piper — 이미 설치됨');
  } catch {
    say('· venv 는 있는데 piper 가 없습니다. 다시 설치합니다');
  }
}

if (!piperOk) {
  try {
    execFileSync('python3', ['--version'], { stdio: 'pipe' });
  } catch {
    console.error('✘ python3 를 찾을 수 없습니다.\n  macOS: brew install python3');
    process.exit(1);
  }
  if (!existsSync(PY)) {
    say('· 파이썬 venv 생성 중…');
    run('python3', ['-m', 'venv', VENV]);
  }
  say('· piper-tts 설치 중… (몇 분 걸립니다)');
  run(PY, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
  run(PY, ['-m', 'pip', 'install', '--quiet', 'piper-tts']);
  try {
    execFileSync(PY, ['-m', 'piper', '--help'], { stdio: 'pipe' });
    say('✓ piper 설치 완료');
  } catch {
    console.error('✘ piper 설치는 됐는데 실행되지 않습니다. 위 pip 출력을 확인하세요.');
    process.exit(1);
  }
}

// ── 2. 음성 모델 ────────────────────────────────────────────────────────────
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

// ── 3. env ─────────────────────────────────────────────────────────────────
const envPath = join(ROOT, 'tts-env.sh');
writeFileSync(envPath, `# oh-my-easy-video — 한국어 TTS 환경\n# 다시 만들려면: node setup.mjs\n${envLines()}\n`);

say(`
설치 완료.

  source ${envPath}

또는 셸 설정에 직접 넣으세요:

${envLines()}

⚠ 음성 모델(ko_KR-kss-medium)은 CC BY-NC-SA 4.0 입니다 — 상업적 용도로 쓸 수 없습니다.`);
