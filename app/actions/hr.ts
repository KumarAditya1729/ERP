'use server'
import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { staffSchema } from '@/lib/validations/schemas';
import crypto from 'crypto';

// ── Email helper ──────────────────────────────────────────────────────────────
// Use Resend if API key is configured; silently skip if not yet configured.
async function sendStaffWelcomeEmail(opts: {
  to: string;
  firstName: string;
  role: string;
  appUrl: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || 'noreply@nexschool.in';

  if (!resendKey) {
    logger.warn('[HR] RESEND_API_KEY not set — skipping staff welcome email', { to: opts.to });
    return;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(resendKey);

    // We use a Supabase magic link (no password transmitted in email).
    // The user sets their own password via the link.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: opts.to,
      options: {
        redirectTo: `${opts.appUrl}/auth/callback`,
      },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      logger.error('[HR] Failed to generate magic link', linkErr, { to: opts.to });
      // Fall back to instructions-only email
    }

    const loginLink = linkData?.properties?.action_link || `${opts.appUrl}/en/login`;

    await resend.emails.send({
      from: fromAddress,
      to: opts.to,
      subject: `You've been invited to NexSchool AI`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#7C3AED;">Welcome to NexSchool AI</h2>
          <p>Hi ${opts.firstName},</p>
          <p>You have been added as a <strong>${opts.role}</strong> on the NexSchool AI school management platform.</p>
          <p>Click the button below to log in and set up your account. This link expires in 24 hours.</p>
          <p style="margin:24px 0;">
            <a href="${loginLink}"
               style="background:#7C3AED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
              Accept Invite &amp; Log In
            </a>
          </p>
          <p style="color:#666;font-size:13px;">
            If the button doesn't work, copy this link:<br/>
            <a href="${loginLink}" style="color:#7C3AED;">${loginLink}</a>
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
          <p style="color:#999;font-size:12px;">
            You received this email because a school administrator added you to their NexSchool AI account.
            If this was a mistake, you can ignore this email.
          </p>
        </div>
      `,
    });

    logger.info('[HR] Staff welcome email sent', { to: opts.to });
  } catch (err) {
    // Email failure is non-fatal — user account is already created
    logger.error('[HR] Staff welcome email failed (non-fatal)', err, { to: opts.to });
  }
}

// ── Server Action: addStaff ────────────────────────────────────────────────────

export async function addStaff(formData: FormData) {
  const { error: authErr } = await requireAuth(['admin', 'teacher', 'staff']);
  if (authErr) throw new Error('Unauthorized');

  const supabase = createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (!supabaseUser) return { success: false, error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', supabaseUser.id)
    .single();
  if (!profile) return { success: false, error: 'Profile not found' };

  const rawData = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    role: formData.get('role') as string,
    department: (formData.get('department') as string) || 'General',
    salary: formData.get('salary') || '0',
    email: formData.get('email') as string,
  };

  const validationResult = staffSchema.safeParse(rawData);
  if (!validationResult.success) {
    return {
      success: false,
      error: 'Validation failed: ' + validationResult.error.errors.map(e => e.message).join(', '),
    };
  }

  const { first_name, last_name, role, department, salary, email } = validationResult.data;

  // Generate a cryptographically random temporary password.
  // NOTE: This is only a fallback. The actual user login is via the magic link
  // in the welcome email. The temp password is never logged or returned to the client.
  const tempPassword = crypto.randomBytes(16).toString('base64url');

  // ── Create auth user ──────────────────────────────────────────────────────────
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword, // temp — user will use magic link from email
    email_confirm: true,
    user_metadata: { role, tenant_id: profile.tenant_id, first_name, last_name },
  });

  if (authError || !authData.user) {
    logger.error('[HR] Auth user creation failed', authError, { email });
    return { success: false, error: authError?.message || 'Auth error' };
  }

  // FIX S1: Update app_metadata to ensure RLS works
  await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
    app_metadata: { role, tenant_id: profile.tenant_id },
  });

  // ── Sync profile ────────────────────────────────────────────────────────────
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: authData.user.id,
    tenant_id: profile.tenant_id,
    first_name,
    last_name,
    role,
    email,
    salary,
    department,
  });

  if (profileError) {
    logger.error('[HR] Profile upsert failed', profileError, { email });
    return { success: false, error: profileError.message };
  }

  // ── Send welcome email (non-blocking, non-fatal) ────────────────────────────
  await sendStaffWelcomeEmail({
    to: email,
    firstName: first_name,
    role,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://nexschool.in',
  });

  logger.info('[HR] Staff member added', { email, role, tenantId: profile.tenant_id });
  revalidatePath('/', 'layout');
  return { success: true };
}
