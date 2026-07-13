const fs = require('fs');

const win1252ToByte = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91,
  '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F
};

function restoreMojibake(str) {
  let bytes = [];
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    const code = str.charCodeAt(i);
    
    // Windows-1252 reverse mapping
    if (win1252ToByte[char] !== undefined) {
      bytes.push(win1252ToByte[char]);
    } else if (code <= 0xFF) {
      bytes.push(code);
    } else {
      // Keep it as is (if some characters weren't corrupted or are outside this range)
      const utf8Buf = Buffer.from(char, 'utf8');
      for(let j=0; j<utf8Buf.length; j++) bytes.push(utf8Buf[j]);
    }
    i++;
  }
  
  try {
    return Buffer.from(bytes).toString('utf8');
  } catch (e) {
    return str;
  }
}

const files = [
  'c:/Users/vagnermoraes/Desktop/AgroVendas-main/frontend/app/page.tsx',
  'c:/Users/vagnermoraes/Desktop/AgroVendas-main/frontend/app/alertas/page.tsx',
  'c:/Users/vagnermoraes/Desktop/AgroVendas-main/frontend/app/compras/page.tsx',
  'c:/Users/vagnermoraes/Desktop/AgroVendas-main/frontend/app/financeiro/cash-flow/page.tsx',
  'c:/Users/vagnermoraes/Desktop/AgroVendas-main/frontend/app/financeiro/pagar/page.tsx',
  'c:/Users/vagnermoraes/Desktop/AgroVendas-main/frontend/app/financeiro/receber/page.tsx',
  'c:/Users/vagnermoraes/Desktop/AgroVendas-main/frontend/app/fiscal/page.tsx',
  'c:/Users/vagnermoraes/Desktop/AgroVendas-main/frontend/app/vendas/page.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    // We only want to restore if it actually contains Mojibake. 
    // Checking for typical Mojibake sequences like Ã (0xC3) followed by something.
    if (content.includes('Ã') || content.includes('ðŸ')) {
      let restored = restoreMojibake(content);
      // Double check it didn't break normal characters
      if (restored !== content) {
        fs.writeFileSync(f, restored, 'utf8');
        console.log('Restored: ' + f);
      }
    }
  }
});
