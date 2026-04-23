const fs = require('fs');
const path = require('path');

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

const apiRoutes = [
  'app/api/webhook/route.ts',
  'app/api/chat/route.ts',
  'app/api/signup/route.ts',
  'app/api/health/route.ts',
  'app/api/dashboard/stats/route.ts',
  'app/api/create-checkout/route.ts',
  'app/api/logs/stream/route.ts',
  'app/api/workers/sms/route.ts',
  // webhooks don't need requireAuth
];

for (const file of actionFiles) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('requireAuth')) {
    content = content.replace(/'use server'/, "'use server'\nimport { requireAuth } from '@/lib/auth-guard';");
    
    // Naively inject requireAuth into exported functions
    content = content.replace(/export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (match) => {
      return match + `\n  const { user, tenantId, error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);\n  if (authErr) throw new Error('Unauthorized');\n`;
    });
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}

for (const file of apiRoutes) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('requireAuth')) {
      content = "import { requireAuth } from '@/lib/auth-guard';\n" + content;
      content = content.replace(/export\s+async\s+function\s+(GET|POST|PUT|DELETE)\s*\([^)]*\)\s*\{/g, (match) => {
        return match + `\n  const { user, tenantId, error: authErr } = await requireAuth();\n  if (authErr) return authErr;\n`;
      });
      fs.writeFileSync(file, content);
      console.log('Fixed API', file);
    }
  }
}
