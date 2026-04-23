const fs = require('fs');
const glob = require('glob'); // Note: we'll just use fs.readdirSync if glob isn't available

const actionFiles = [
  'app/actions/academics.ts',
  'app/actions/admissions.ts',
  'app/actions/attendance.ts',
  'app/actions/auth.ts',
  'app/actions/communication.ts',
  'app/actions/fees.ts',
  'app/actions/hostel.ts',
  'app/actions/hr.ts',
  'app/actions/register.ts',
  'app/actions/reports.ts',
  'app/actions/students.ts',
  'app/actions/transport.ts'
];

for (const file of actionFiles) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\);/g, 'const { data: { user: supabaseUser } } = await supabase.auth.getUser();');
    content = content.replace(/if \(!user\)/g, 'if (!supabaseUser)');
    content = content.replace(/user\.id/g, 'supabaseUser.id');
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}
