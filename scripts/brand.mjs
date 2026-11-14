#!/usr/bin/env node
// Validates clinic.config.json and generates the clinic's brand into the app:
//   src/app/core/config/brand.generated.ts   name, tagline, colours, default features
//   src/styles/_brand.generated.scss         Material palettes + CSS variables
//   src/index.html                           <title> and theme-color (between brand markers)
//   public/branding/logo.svg                 copy of the configured logo
// `--check` writes nothing and fails if the generated files are out of date.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderIndexHtml, renderScss, renderTs, validate } from './lib/brand-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const read = (file) => readFileSync(join(root, file), 'utf8');

function fail(messages) {
  console.error(`clinic.config.json is invalid:\n${messages.map((m) => `  - ${m}`).join('\n')}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(read('clinic.config.json'));
} catch (error) {
  fail([`cannot read clinic.config.json (${error.message})`]);
}
const errors = validate(JSON.parse(read('clinic.config.schema.json')), config);
if (errors.length) fail(errors);
if (!existsSync(join(root, config.logo))) fail([`$.logo: file "${config.logo}" does not exist`]);

const outputs = [
  ['src/app/core/config/brand.generated.ts', renderTs(config)],
  ['src/styles/_brand.generated.scss', renderScss(config)],
  ['src/index.html', renderIndexHtml(read('src/index.html'), config)],
  ['public/' + config.logo, readFileSync(join(root, config.logo), 'utf8')],
];

const stale = [];
for (const [file, content] of outputs) {
  const target = join(root, file);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (current === content) continue;
  stale.push(file);
  if (!check) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

if (check && stale.length) {
  console.error(
    `Generated brand files are out of date: ${stale.join(', ')}. Run \`npm run brand\`.`,
  );
  process.exit(1);
}
console.log(
  check ? 'brand: up to date' : `brand: ${config.name.en} (${stale.length} file(s) updated)`,
);
