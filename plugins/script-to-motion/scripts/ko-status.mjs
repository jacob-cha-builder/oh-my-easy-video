#!/usr/bin/env node
// 진행상태 안내 — 언제든 "지금 어디까지 됐지?" 를 물으면 다음 실행 명령을 알려준다.
// SCRIPT.md 가 없어도(Step 0~2) 동작한다는 점이 check-script.mjs 와 다르다.
//
// 사용: node ko-status.mjs --project videos/<name>

import { resolve } from 'node:path';
import { detectStatus } from './status.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]?.replace(/^--/, '')] = process.argv[i + 1];

const dir = resolve(args.project ?? '.');
const status = detectStatus(dir);

console.log(`상태: ${status.state}`);
console.log(`▶ ${status.nextAction}`);
if (status.nextCommand) {
  console.log('');
  for (const line of status.nextCommand.split('\n')) console.log(`  ${line}`);
}
