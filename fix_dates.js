const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}
const files = walk('c:/Users/vagnermoraes/Desktop/AgroVendas-main/frontend/app');
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let newContent = content.replace(/toLocaleDateString\('pt-BR'\)/g, "toLocaleDateString('pt-BR', { timeZone: 'UTC' })");
  if (content !== newContent) {
    fs.writeFileSync(f, newContent, 'utf8');
    console.log('Updated ' + f);
  }
});
