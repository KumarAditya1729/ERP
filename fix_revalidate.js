const fs = require('fs');
const path = require('path');
const dir = './app/actions';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/revalidatePath\('[^']+'\)/g, "revalidatePath('/', 'layout')");
  // Some files had revalidatePath('/', 'layout') already, they won't be matched by the regex above 
  // since it doesn't match the second argument, which is fine.
  fs.writeFileSync(filePath, content);
});
console.log('Fixed revalidate path caches');
