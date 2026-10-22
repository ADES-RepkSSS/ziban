const fs = require('fs');
const path = require('path');
const docs = ['README.md','CONTRIBUTING.md','SECURITY.md','PRIVACY.md','GOVERNANCE.md','CHANGELOG.md','CODE_OF_CONDUCT.md','docs/06-github-community.md','docs/assets/README.md','docs/05-experimental-v0.1.md'];
let bad = false;
for (const doc of docs) {
  const text = fs.readFileSync(doc, 'utf8');
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const target = decodeURI(link.split('#')[0]);
    if (target && !fs.existsSync(path.resolve(path.dirname(doc), target))) {
      bad = true; console.error(`LINK FAIL ${doc} -> ${link}`);
    }
  }
}
if (bad) process.exit(1); console.log('local links ok');
