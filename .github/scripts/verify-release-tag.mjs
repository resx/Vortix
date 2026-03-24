#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const tauriConfig = readJson(path.join('src-tauri', 'tauri.conf.json'));
const packageJson = readJson('package.json');
const inputTag = process.argv[2] || process.env.GITHUB_REF_NAME || process.env.RELEASE_TAG;

if (!inputTag) {
  console.error('[release-tag][error] Missing tag input. Pass a tag argument or set GITHUB_REF_NAME.');
  process.exit(1);
}

const expectedTag = 'v' + tauriConfig.version;
if (inputTag !== expectedTag) {
  console.error('[release-tag][error] Tag mismatch. expected=' + expectedTag + ', actual=' + inputTag);
  process.exit(1);
}

if (packageJson.version !== tauriConfig.version) {
  console.warn('[release-tag][warn] package.json version does not match Tauri version: package.json=' + packageJson.version + ', tauri=' + tauriConfig.version);
}

console.log('[release-tag] verified ' + inputTag);
