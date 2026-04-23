const fs = require('fs');
const file = 'app/[locale]/dashboard/transport/LiveMap.tsx';
let content = fs.readFileSync(file, 'utf8');

// The multi_replace might have messed up the icon code block, let's reset the icon code to what it likely was and then globally replace window.google
content = content.replace(/icon: \{\s*path: \(window as any\)\.google\.maps\.SymbolPath\.CIRCLE,\s*scale: 8,\s*\}/g, "icon: { url: v.ignition_on ? '/bus-active.svg' : '/bus-parked.svg', scaledSize: new (window as any).google.maps.Size(40, 40) }");

// Replace any remaining window.google that are not already (window as any).google
content = content.replace(/(?<!\(\s*window\s+as\s+any\s*\)\s*\.)\bwindow\.google\b/g, '(window as any).google');

fs.writeFileSync(file, content);
console.log('Fixed LiveMap.tsx types');
