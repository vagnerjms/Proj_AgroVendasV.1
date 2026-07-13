const fs = require('fs');
const path = require('path');

const logPath = 'C:/Users/vagnermoraes/.gemini/antigravity/brain/75afcdd1-9d40-4571-be4f-f3bb95754bad/.system_generated/logs/transcript.jsonl';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toLowerCase().includes('planilha') || line.toLowerCase().includes('planilha') || line.toLowerCase().includes('repassado') || line.toLowerCase().includes('desconto')) {
      try {
        const obj = JSON.parse(line);
        if (obj.content) {
          console.log(`--- Line ${i} (${obj.source} - ${obj.type}) ---`);
          console.log(obj.content.substring(0, 500));
        }
      } catch (e) {
        // Not JSON
      }
    }
  }
} catch (err) {
  console.error(err);
}
