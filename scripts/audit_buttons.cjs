const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk('./src');
const issues = [];
const emptyHandlers = [];

files.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  // Match buttons
  const buttonRegex = /<button\b([^>]*)>/gs;
  let match;
  while ((match = buttonRegex.exec(content)) !== null) {
    const attrs = match[1];
    const hasOnClick = /onClick\s*=/i.test(attrs);
    const hasTypeSubmit = /type\s*=\s*['"]submit['"]/i.test(attrs);
    const lineNum = content.substring(0, match.index).split('\n').length;

    if (!hasOnClick && !hasTypeSubmit) {
      issues.push({ file: filePath, line: lineNum, attrs: attrs.trim().replace(/\s+/g, ' ').substring(0, 120) });
    }
  }

  // Check for empty handlers
  const emptyRegex = /onClick\s*=\s*\{\s*(?:\(\s*\)\s*=>\s*\{\s*\}|\(\s*e\s*\)\s*=>\s*\{\s*\}|undefined|null)\s*\}/gs;
  let emptyMatch;
  while ((emptyMatch = emptyRegex.exec(content)) !== null) {
    const lineNum = content.substring(0, emptyMatch.index).split('\n').length;
    emptyHandlers.push({ file: filePath, line: lineNum, code: emptyMatch[0] });
  }
});

console.log('=== BUTTONS WITHOUT ONCLICK AND NOT TYPE=SUBMIT ===');
console.log('Total found:', issues.length);
issues.forEach(i => console.log(`${i.file}:${i.line} -> ${i.attrs}`));

console.log('\n=== EMPTY ONCLICK HANDLERS ===');
console.log('Total found:', emptyHandlers.length);
emptyHandlers.forEach(i => console.log(`${i.file}:${i.line} -> ${i.code}`));
