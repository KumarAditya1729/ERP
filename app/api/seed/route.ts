import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
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
      { email: 'admin_v3@nexschool.com', role: 'admin' },
      { email: 'teacher_v3@nexschool.com', role: 'teacher' },
      { email: 'parent_v3@nexschool.com', role: 'parent' },
      { email: 'staff_v3@nexschool.com', role: 'staff' },
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
        password: 'Admin1234!',
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
            // Update password so it matches Admin1234! in case it was corrupted
            await supabaseAdmin.auth.admin.updateUserById(
                (await supabaseAdmin.auth.admin.listUsers()).data.users.find(x => x.email === u.email)?.id as string,
                { password: 'Admin1234!' }
            );
            results.push(`${u.email} already existed, updated password to Admin1234!`);
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
