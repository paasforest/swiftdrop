#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function getAllFiles(dir, extList) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const st = fs.statSync(full);
    if (st.isDirectory() && file !== 'node_modules') {
      files = files.concat(getAllFiles(full, extList));
    } else if (extList.includes(path.extname(file))) {
      files.push(full);
    }
  }
  return files;
}

function collectImports(content) {
  const out = [];
  const reFrom = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
  const reReq = /require\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;
  let m;
  while ((m = reFrom.exec(content))) out.push(m[1]);
  while ((m = reReq.exec(content))) out.push(m[1]);
  return out;
}

function resolveExists(absBase) {
  const exts = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];
  return exts.some((e) => {
    try {
      return fs.statSync(absBase + e).isFile();
    } catch {
      return false;
    }
  });
}

const roots = ['src', 'swiftdrop/backend/src'].filter((d) => fs.existsSync(d));
const scanFiles = [];
for (const r of roots) {
  scanFiles.push(...getAllFiles(r, ['.js', '.jsx', '.ts', '.tsx']));
}
if (fs.existsSync('App.js')) scanFiles.push('App.js');

const missing = new Set();

for (const file of scanFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  for (const p of collectImports(content)) {
    const abs = path.resolve(dir, p);
    if (!resolveExists(abs)) {
      missing.add(`${path.relative(process.cwd(), abs)} (from: ${file})`);
    }
  }
}

console.log('MISSING FILES:');
[...missing].sort().forEach((m) => console.log(m));
console.log('Total:', missing.size);
