#!/usr/bin/env node
// 발표자료(PDF/이미지)를 슬라이드 PNG로 정규화한다. 의존성 0(서브프로세스만).
//
// 사용:
//   node deck-to-slides.mjs --project videos/<name> --source <deck.pdf | 이미지 폴더>
//
// 출력:
//   <project>/deck/slides/slide-01.png ...
//   <project>/deck/manifest.json   { source, slides: [{ n, path, width, height }] }
//
// PDF는 poppler(pdftoppm)로 200dpi PNG로 래스터화한다. 이미지 폴더는 파일명 순서대로
// slide-01.png... 로 정규화해 복사한다. 치수는 ffprobe로 읽는다(ko-tts.mjs와 동일 도구).
//
// skills/deck-to-video/SKILL.md 의 Step 0.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, copyFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i]?.replace(/^--/, '')] = process.argv[i + 1];
}

const projectDir = resolve(args.project ?? '.');
const source = args.source ? resolve(args.source) : null;
const outDir = join(projectDir, 'deck', 'slides');
const manifestPath = join(projectDir, 'deck', 'manifest.json');

if (!source || !existsSync(source)) {
  console.error(`[FATAL] --source 가 없거나 찾을 수 없습니다: ${source ?? '(미지정)'}`);
  console.error(`  사용: node deck-to-slides.mjs --project videos/<name> --source <deck.pdf | 이미지 폴더>`);
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg']);
const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true });

const dimsOf = (path) => {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=s=x:p=0', path,
  ], { encoding: 'utf8' }).trim();
  const [width, height] = out.split('x').map(Number);
  return { width, height };
};

let rawPaths;

if (extname(source).toLowerCase() === '.pdf') {
  try {
    execFileSync('which', ['pdftoppm'], { stdio: 'pipe' });
  } catch {
    console.error(
      `[FATAL] pdftoppm 을 찾을 수 없습니다 (poppler).\n` +
        `  설치(macOS): brew install poppler\n`,
    );
    process.exit(2);
  }
  execFileSync('pdftoppm', ['-png', '-r', '200', source, join(outDir, 'raw')], { stdio: 'inherit' });
  rawPaths = readdirSync(outDir)
    .filter((f) => f.startsWith('raw-') && IMAGE_EXT.has(extname(f).toLowerCase()))
    .sort(naturalSort)
    .map((f) => join(outDir, f));
} else if (statSync(source).isDirectory()) {
  const files = readdirSync(source)
    .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
    .sort(naturalSort);
  if (files.length === 0) {
    console.error(`[FATAL] ${source} 에서 이미지(.png/.jpg/.jpeg)를 찾지 못했습니다.`);
    process.exit(2);
  }
  rawPaths = files.map((f) => {
    const dest = join(outDir, `raw-${f}`);
    copyFileSync(join(source, f), dest);
    return dest;
  });
} else {
  console.error(`[FATAL] --source 는 PDF 파일이나 이미지 폴더여야 합니다: ${source}`);
  process.exit(2);
}

if (rawPaths.length === 0) {
  console.error(`[FATAL] 슬라이드를 하나도 만들지 못했습니다.`);
  process.exit(2);
}

const slidePaths = rawPaths.map((p, i) => {
  const dest = join(outDir, `slide-${String(i + 1).padStart(2, '0')}${extname(p).toLowerCase()}`);
  renameSync(p, dest);
  return dest;
});

const slides = slidePaths.map((p, i) => {
  const { width, height } = dimsOf(p);
  return { n: i + 1, path: `deck/slides/${p.split('/').pop()}`, width, height };
});

writeFileSync(manifestPath, JSON.stringify({ source: args.source, slides }, null, 2) + '\n');

console.log(`✔ 슬라이드 ${slides.length}장 → ${outDir}`);
console.log(`  ${manifestPath}`);
console.log(`\n다음: skills/deck-to-video/SKILL.md 를 따라 각 슬라이드를 보고 인터뷰 → SCRIPT.md 초안을 진행하세요.`);
