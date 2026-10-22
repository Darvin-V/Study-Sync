import fs from 'node:fs';
import path from 'node:path';

function check(dir) {
  const matches = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (f === 'node_modules' || f === 'dist' || full.includes(path.join('src', 'data'))) continue;
    if (fs.statSync(full).isDirectory()) {
      matches.push(...check(full));
    } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes('../data') || c.includes('./data') || c.includes('/data/')) {
        matches.push(full);
      }
    }
  }
  return matches;
}

const found = check('./src');
console.log('Files in src referencing data directory:', found);
