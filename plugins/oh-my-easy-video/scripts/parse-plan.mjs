// SCRIPT.md / STORYBOARD.md 파서. 의존성 0.
//
// 두 포맷 모두 상류 스펙을 따른다:
//   hyperframes-core/references/script-format.md
//   hyperframes-core/references/storyboard-format.md
//
// 상류 파서(@hyperframes/core/storyboard)는 "lenient — never throws" 다.
// 여기도 같은 태도를 취한다: 구조는 관대하게, 숫자는 엄격하게.

/**
 * SCRIPT.md → [{ n, label, frame, timeStart, timeEnd, text }]
 *
 * 형식:
 *   ## Line 1 — Hook (Frame 1)
 *   **Time:** 0.0 – 3.0s
 *   **Delivery:** ...
 *       발화 텍스트 (들여쓴 블록 — TTS 에 넘어가는 유일한 부분)
 */
export const parseScript = (md) => {
  const out = [];
  const blocks = md.split(/^##\s+/m).slice(1);

  blocks.forEach((block, idx) => {
    const head = block.split('\n', 1)[0] ?? '';
    // "Line 3 — 라벨 (Frame 3)" — Line/Frame 번호 모두 선택적
    const nMatch = head.match(/Line\s+(\d+)/i);
    const fMatch = head.match(/Frame\s+(\d+)/i);
    const label = head.replace(/^Line\s+\d+\s*[—–-]?\s*/i, '').replace(/\s*\(Frame\s+\d+\)\s*$/i, '').trim();

    // **Time:** 0.0 – 3.0s   (en-dash / em-dash / hyphen 모두 허용)
    const t = block.match(/\*\*Time:\*\*\s*([\d.]+)\s*[–—-]\s*([\d.]+)\s*s/i);

    // 들여쓴 블록 = 발화 텍스트. 코드펜스도 허용한다.
    const body = block.slice(head.length);
    let text = '';
    const fence = body.match(/```[a-z]*\n([\s\S]*?)```/i);
    if (fence) {
      text = fence[1].trim();
    } else {
      const indented = body
        .split('\n')
        .filter((l) => /^(\t| {4,})\S/.test(l))
        .map((l) => l.replace(/^(\t| {4,})/, '').trim());
      text = indented.join(' ').trim();
    }
    if (!text) return;

    out.push({
      n: nMatch ? Number(nMatch[1]) : idx + 1,
      label,
      frame: fMatch ? Number(fMatch[1]) : null,
      timeStart: t ? Number(t[1]) : null,
      timeEnd: t ? Number(t[2]) : null,
      text,
    });
  });

  return out;
};

/**
 * STORYBOARD.md → { globals, frames: [{ n, title, duration, voiceover, ... }] }
 *
 * 형식: YAML frontmatter + "## Frame N — Title" + "- key: value" 불릿
 */
export const parseStoryboard = (md) => {
  const globals = {};
  let body = md;

  const fm = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (m) globals[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    body = md.slice(fm[0].length);
  }

  const frames = [];
  // Frame / Beat / Scene 을 H2/H3 에서 모두 받는다 (상류 스펙)
  const blocks = body.split(/^#{2,3}\s+/m).slice(1);

  blocks.forEach((block, idx) => {
    const head = block.split('\n', 1)[0] ?? '';
    if (!/^(Frame|Beat|Scene)\b/i.test(head)) return;
    const nMatch = head.match(/^(?:Frame|Beat|Scene)\s+(\d+)/i);
    const title = head.replace(/^(?:Frame|Beat|Scene)\s+\d+\s*[—–-]?\s*/i, '').trim();

    const meta = {};
    for (const line of block.split('\n')) {
      const m = line.match(/^\s*-\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    }

    frames.push({
      n: nMatch ? Number(nMatch[1]) : idx + 1,
      title,
      duration: parseSeconds(meta.duration),
      voiceover: meta.voiceover ?? meta.vo ?? meta.narration ?? null,
      status: meta.status ?? 'outline',
      raw: meta,
    });
  });

  return { globals, frames, totalSec: parseSeconds(globals.duration) };
};

/** "4s" / "4.5s" / "4" → 4 / 4.5 / 4 ; 없으면 null */
export const parseSeconds = (v) => {
  if (v == null) return null;
  const m = String(v).match(/([\d.]+)\s*s?/i);
  return m ? Number(m[1]) : null;
};
