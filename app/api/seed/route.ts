import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const routeEnabled = process.env.ALLOW_DEMO_SEED_ROUTE === 'true';
  const seedSecret = process.env.SEED_DEMO_SECRET || process.env.CRON_SECRET;

  if (!routeEnabled || !seedSecret) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    return NextResponse.json(
      { error: 'Use the seed script or call this route with a bearer token.' },
      { status: 405 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}

export async function POST(req: Request) {
  const routeEnabled = process.env.ALLOW_DEMO_SEED_ROUTE === 'true';
  const seedSecret = process.env.SEED_DEMO_SECRET || process.env.CRON_SECRET;

  if (!routeEnabled || !seedSecret) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (req.headers.get('authorization') !== `Bearer ${seedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Create Tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert([{
        name: 'NexSchool Demo',
        subdomain: 'nexschool',
        status: 'active'
      }])
      .select('id')
      .single();

    let tenantId = tenant?.id;
    if (tenantError) {
      if (tenantError.code === '23505' || tenantError.code === '42703') {
        const { data: existing } = await supabaseAdmin.from('tenants').select('id').limit(1).single();
        tenantId = existing?.id;
      } else {
        return NextResponse.json({ error: 'Tenant creation failed', details: tenantError });
      }
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Could not resolve tenant ID' });
    }

    const users = [
      { email: 'admin@nexschool.local', role: 'admin' },
      { email: 'teacher@nexschool.local', role: 'teacher' },
      { email: 'parent@nexschool.local', role: 'parent' },
      { email: 'staff@nexschool.local', role: 'staff' },
    ];

    const results = [];

    // First, find and delete any existing _v3 users that were corrupted by manual SQL inserts
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (!listError && existingUsers?.users) {
      for (const eu of existingUsers.users) {
        if (eu.email && users.map(u => u.email).includes(eu.email)) {
          await supabaseAdmin.auth.admin.deleteUser(eu.id);
          results.push(`Deleted corrupted user: ${eu.email}`);
        }
      }
    }

    for (const u of users) {
      const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: 'Password!123',
        email_confirm: true,
        user_metadata: {
          role: u.role,
          tenant_id: tenantId,
          first_name: u.role.charAt(0).toUpperCase() + u.role.slice(1),
          last_name: 'Demo'
        },
        app_metadata: {
          role: u.role,
          tenant_id: tenantId
        }
      });

      if (error) {
        if (error.message.includes('already exists')) {
            // Update password so it matches Password!123 in case it was corrupted
            await supabaseAdmin.auth.admin.updateUserById(
                (await supabaseAdmin.auth.admin.listUsers()).data.users.find(x => x.email === u.email)?.id as string,
                { password: 'Password!123' }
            );
            results.push(`${u.email} already existed, updated password to Password!123`);
        } else {
            results.push(`Error creating ${u.email}: ${error.message}`);
        }
      } else {
        results.push(`Created ${u.email}`);
      }
    }

    return NextResponse.json({ success: true, tenantId, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
