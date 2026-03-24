#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

const errors = [];
const warnings = [];
const notes = [];

try {
  const packageJson = readJson('package.json');
  const tauriConfig = readJson(path.join('src-tauri', 'tauri.conf.json'));

  if (!fs.existsSync(path.join(repoRoot, 'pnpm-lock.yaml'))) {
    errors.push('Missing pnpm-lock.yaml. CI expects a committed pnpm lockfile.');
  }

  if (typeof packageJson.packageManager !== 'string' || !packageJson.packageManager.startsWith('pnpm@')) {
    errors.push('package.json must declare a pnpm packageManager, for example pnpm@10.31.0.');
  } else {
    notes.push('packageManager: ' + packageJson.packageManager);
  }

  if (typeof packageJson.version !== 'string' || !packageJson.version.trim()) {
    errors.push('package.json is missing a valid version field.');
  }

  if (typeof tauriConfig.version !== 'string' || !tauriConfig.version.trim()) {
    errors.push('src-tauri/tauri.conf.json is missing a valid version field.');
  }

  if (!errors.length && packageJson.version !== tauriConfig.version) {
    warnings.push(
      'Version mismatch detected: package.json=' + packageJson.version + ', src-tauri/tauri.conf.json=' + tauriConfig.version + '. Release validation uses the Tauri version.'
    );
  } else if (!errors.length) {
    notes.push('version: ' + tauriConfig.version);
  }

  const requiredScripts = ['typecheck', 'build:web', 'lint'];
  for (const name of requiredScripts) {
    if (!packageJson.scripts || typeof packageJson.scripts[name] !== 'string') {
      errors.push('Missing required package.json script: ' + name);
    }
  }
} catch (error) {
  errors.push(error instanceof Error ? error.message : String(error));
}

for (const line of notes) {
  console.log('[preflight] ' + line);
}
for (const line of warnings) {
  console.warn('[preflight][warn] ' + line);
}
for (const line of errors) {
  console.error('[preflight][error] ' + line);
}

if (errors.length > 0) {
  process.exit(1);
}
