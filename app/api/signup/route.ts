
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(req: Request) {


  const { email, password, schoolName, subdomain } = await req.json()

  // 1. Create Tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: schoolName,
      subdomain,
    })
    .select()
    .single()

  if (tenantError) {
    return NextResponse.json({ error: tenantError.message }, { status: 400 })
  }

  // 2. Create User with metadata
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'admin',
        tenant_id: tenant.id,
      },
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
