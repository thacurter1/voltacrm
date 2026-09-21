const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk('./src');
const buttonsWithoutHandler = [];
const emptyHandlers = [];
const buttonsWithTypeSubmitOutsideForm = [];

files.forEach(filePath => {
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  function visit(node, parentForm = false) {
    const isForm = node.kind === ts.SyntaxKind.JsxElement &&
      node.openingElement.tagName.getText(sourceFile) === 'form';
    const currentForm = parentForm || isForm;

    if (node.kind === ts.SyntaxKind.JsxElement || node.kind === ts.SyntaxKind.JsxSelfClosingElement) {
      const tag = (node.kind === ts.SyntaxKind.JsxElement ? node.openingElement : node);
      const tagName = tag.tagName.getText(sourceFile);

      if (tagName === 'button') {
        let onClickAttr = null;
        let typeAttr = null;

        tag.attributes.properties.forEach(prop => {
          if (prop.kind === ts.SyntaxKind.JsxAttribute) {
            const name = prop.name.getText(sourceFile);
            if (name === 'onClick') onClickAttr = prop;
            if (name === 'type') typeAttr = prop;
          }
        });

        const { line } = sourceFile.getLineAndCharacterOfPosition(tag.getStart(sourceFile));
        const lineNum = line + 1;
        const typeValue = typeAttr && typeAttr.initializer ? typeAttr.initializer.getText(sourceFile).replace(/['"]/g, '') : null;

        // Check if missing both onClick and type="submit"
        if (!onClickAttr && typeValue !== 'submit') {
          buttonsWithoutHandler.push({
            file: filePath,
            line: lineNum,
            type: typeValue,
            code: tag.getText(sourceFile).substring(0, 100)
          });
        }

        // Check if type="submit" outside form
        if (typeValue === 'submit' && !currentForm && !onClickAttr) {
          buttonsWithTypeSubmitOutsideForm.push({
            file: filePath,
            line: lineNum,
            code: tag.getText(sourceFile).substring(0, 100)
          });
        }

        // Check if onClick is empty or stub
        if (onClickAttr && onClickAttr.initializer) {
          const initText = onClickAttr.initializer.getText(sourceFile);
          // Check for empty functions
          if (/\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(initText) ||
              /\{\s*\(\s*e\s*\)\s*=>\s*\{\s*\}\s*\}/.test(initText) ||
              /\{\s*undefined\s*\}/.test(initText) ||
              /\{\s*null\s*\}/.test(initText)) {
            emptyHandlers.push({
              file: filePath,
              line: lineNum,
              handler: initText,
              code: tag.getText(sourceFile).substring(0, 100)
            });
          }
        }
      }
    }

    ts.forEachChild(node, child => visit(child, currentForm));
  }

  visit(sourceFile);
});

console.log('=== 1. BUTTONS WITHOUT ONCLICK AND NOT TYPE="SUBMIT" ===');
console.log('Total:', buttonsWithoutHandler.length);
buttonsWithoutHandler.forEach(b => console.log(`${b.file}:${b.line} [type=${b.type}] -> ${b.code}`));

console.log('\n=== 2. BUTTONS WITH TYPE="SUBMIT" OUTSIDE A FORM (AND NO ONCLICK) ===');
console.log('Total:', buttonsWithTypeSubmitOutsideForm.length);
buttonsWithTypeSubmitOutsideForm.forEach(b => console.log(`${b.file}:${b.line} -> ${b.code}`));

console.log('\n=== 3. BUTTONS WITH EMPTY / DUMMY ONCLICK HANDLERS ===');
console.log('Total:', emptyHandlers.length);
emptyHandlers.forEach(b => console.log(`${b.file}:${b.line} -> ${b.handler}`));
