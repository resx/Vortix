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

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(repoRoot, relativePath), JSON.stringify(value, null, 2) + '\n');
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function writeText(relativePath, value) {
  fs.writeFileSync(path.join(repoRoot, relativePath), value);
}

function readVersions() {
  const packageJson = readJson('package.json');
  const tauriConfig = readJson(path.join('src-tauri', 'tauri.conf.json'));
  const cargoToml = readText(path.join('src-tauri', 'Cargo.toml'));
  const cargoMatch = cargoToml.match(/(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/);

  if (!cargoMatch) {
    throw new Error('Unable to locate [package].version in src-tauri/Cargo.toml');
  }

  return {
    packageJson,
    tauriConfig,
    cargoToml,
    cargoVersion: cargoMatch[2],
  };
}

function syncVersion(inputVersion) {
  const current = readVersions();
  const nextVersion = inputVersion || process.env.npm_package_version || current.packageJson.version;

  if (!nextVersion) {
    console.error('[release-version][error] Missing target version.');
    process.exit(1);
  }

  const updatedFiles = [];

  if (current.packageJson.version !== nextVersion) {
    current.packageJson.version = nextVersion;
    writeJson('package.json', current.packageJson);
    updatedFiles.push('package.json');
  }

  if (current.tauriConfig.version !== nextVersion) {
    current.tauriConfig.version = nextVersion;
    writeJson(path.join('src-tauri', 'tauri.conf.json'), current.tauriConfig);
    updatedFiles.push('src-tauri/tauri.conf.json');
  }

  if (current.cargoVersion !== nextVersion) {
    const nextCargoToml = current.cargoToml.replace(
      /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
      `$1${nextVersion}$3`,
    );
    writeText(path.join('src-tauri', 'Cargo.toml'), nextCargoToml);
    updatedFiles.push('src-tauri/Cargo.toml');
  }

  if (updatedFiles.length === 0) {
    console.log('[release-version] already in sync at ' + nextVersion);
    return;
  }

  console.log('[release-version] synced ' + nextVersion + ' -> ' + updatedFiles.join(', '));
}

function verifyTag(inputTag) {
  const current = readVersions();
  const versions = [
    ['package.json', current.packageJson.version],
    ['src-tauri/tauri.conf.json', current.tauriConfig.version],
    ['src-tauri/Cargo.toml', current.cargoVersion],
  ];
  const uniqueVersions = [...new Set(versions.map(([, version]) => version))];

  if (uniqueVersions.length !== 1) {
    console.error(
      '[release-tag][error] Version mismatch: ' +
        versions.map(([file, version]) => file + '=' + version).join(', '),
    );
    process.exit(1);
  }

  if (!inputTag) {
    console.error('[release-tag][error] Missing tag input. Pass a tag argument or set GITHUB_REF_NAME.');
    process.exit(1);
  }

  const expectedTag = 'v' + uniqueVersions[0];
  if (inputTag !== expectedTag) {
    console.error('[release-tag][error] Tag mismatch. expected=' + expectedTag + ', actual=' + inputTag);
    process.exit(1);
  }

  console.log('[release-tag] verified ' + inputTag);
}

const [, , command = 'verify-tag', ...args] = process.argv;

switch (command) {
  case 'sync-version':
    syncVersion(args[0]);
    break;
  case 'verify-tag':
    verifyTag(args[0] || process.env.GITHUB_REF_NAME || process.env.RELEASE_TAG);
    break;
  default:
    console.error('[release-version][error] Unknown command: ' + command);
    process.exit(1);
}
