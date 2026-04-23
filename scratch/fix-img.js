const fs = require('fs');

const files = [
  'app/[locale]/billing/page.tsx',
  'app/[locale]/dashboard/layout.tsx',
  'app/[locale]/login/page.tsx',
  'app/[locale]/portal/layout.tsx',
  'app/[locale]/portal/parent/page.tsx',
  'app/[locale]/register/page.tsx',
  'app/[locale]/staff/layout.tsx',
  'app/[locale]/teacher/layout.tsx',
  'components/landing/Footer.tsx',
  'components/landing/Navbar.tsx'
];

for (const f of files) {
  try {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    
    // Replace <img ... /> with <Image ... />
    content = content.replace(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*className="([^"]+)"[^>]*>/g, 
      '<Image src="$1" alt="$2" className="$3" width={120} height={32} priority />');
      
    if (content !== original) {
      if (!content.includes('import Image from \'next/image\'')) {
        content = "import Image from 'next/image';\n" + content;
      }
      fs.writeFileSync(f, content);
      console.log(`Updated ${f}`);
    }
  } catch (err) {
    console.error(`Error processing ${f}:`, err);
  }
}
