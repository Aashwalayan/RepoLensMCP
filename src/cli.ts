#!/usr/bin/env node
import chokidar from 'chokidar';
import { resolveConfig } from './cliConfig.js';
import { pushOnce } from './push.js';

const command = process.argv[2];

async function runPush() {
  const config = resolveConfig();
  console.log(`Pushing ${config.repoName}...`);

  const result = await pushOnce(config);
  if (result.ok) {
    console.log(`✓ Pushed. Download: ${result.downloadUrl}`);
  } else {
    console.error(`✗ Push failed: ${result.error}`);
    process.exitCode = 1;
  }
}

function runWatch() {
  const config = resolveConfig();
  console.log(`Watching ${config.repoName} for changes (Ctrl+C to stop)...`);

  let pending = false;
  let running = false;

  async function triggerPush() {
    if (running) {
      pending = true; // a change came in while a push was in flight — run once more after
      return;
    }
    running = true;
    const result = await pushOnce(config);
    if (result.ok) {
      console.log(`✓ Pushed (${new Date().toLocaleTimeString()}). Download: ${result.downloadUrl}`);
    } else {
      console.error(`✗ Push failed: ${result.error}`);
    }
    running = false;
    if (pending) {
      pending = false;
      triggerPush();
    }
  }

  const watcher = chokidar.watch(config.rootDir, {
    ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  watcher.on('change', () => triggerPush());

  // initial push on startup so the map is fresh before the first edit
  triggerPush();
}

switch (command) {
  case 'push':
    runPush();
    break;
  case 'watch':
    runWatch();
    break;
  default:
    console.log('Usage: repolens <push|watch>');
    process.exit(1);
}