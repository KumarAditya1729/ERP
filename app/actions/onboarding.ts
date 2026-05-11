'use server'
import { requireAuth } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getAdminTenantId() {
  const { user, tenantId, error } = await requireAuth(['admin']);
  if (error || !tenantId) throw new Error('Unauthorized');
  return { user: user!, tenantId };
}

async function advanceStep(tenantId: string, step: number) {
  await supabaseAdmin
    .from('tenants')
    .update({ onboarding_step: step })
    .eq('id', tenantId);
}

// ── Step 1: School Info ─────────────────────────────────────────────────────────

const SchoolInfoSchema = z.object({
  name: z.string().min(3, 'School name must be at least 3 characters'),
  city: z.string().min(2, 'City is required'),
  board_type: z.string().min(1, 'Board type is required'),
  address: z.string().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
});

export async function saveSchoolInfo(formData: FormData) {
  const { tenantId } = await getAdminTenantId();

  const parsed = SchoolInfoSchema.safeParse({
    name: formData.get('name'),
    city: formData.get('city'),
    board_type: formData.get('board_type'),
    address: formData.get('address') || undefined,
    logo_url: formData.get('logo_url') || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({
      name: parsed.data.name,
      city: parsed.data.city,
      logo_url: parsed.data.logo_url || null,
      onboarding_step: 2,
    })
    .eq('id', tenantId);

  if (error) {
    logger.error('onboarding/saveSchoolInfo failed', error, { tenantId });
    return { success: false, error: 'Failed to save school info' };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

// ── Step 2: Academic Year ───────────────────────────────────────────────────────

const AcademicYearSchema = z.object({
  name: z.string().min(4, 'Year name is required (e.g. 2025–26)'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  is_current: z.coerce.boolean().default(true),
});

export async function saveAcademicYear(formData: FormData) {
  const { tenantId } = await getAdminTenantId();

  const parsed = AcademicYearSchema.safeParse({
    name: formData.get('name'),
    start_date: formData.get('start_date'),
    end_date: formData.get('end_date'),
    is_current: formData.get('is_current') ?? true,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  // If marking as current, unmark all others for this tenant
  if (parsed.data.is_current) {
    await supabaseAdmin
      .from('academic_years')
      .update({ is_current: false })
      .eq('tenant_id', tenantId);
  }

  const { error } = await supabaseAdmin
    .from('academic_years')
    .insert({ tenant_id: tenantId, ...parsed.data })
    .select();

  // If duplicate, update instead
  if (error && error.code === '23505') {
    await supabaseAdmin
      .from('academic_years')
      .update({ ...parsed.data })
      .eq('tenant_id', tenantId)
      .eq('name', parsed.data.name);
  } else if (error) {
    logger.error('onboarding/saveAcademicYear failed', error, { tenantId });
    return { success: false, error: 'Failed to save academic year' };
  }

  await advanceStep(tenantId, 3);
  revalidatePath('/', 'layout');
  return { success: true };
}

// ── Step 3: Classes & Sections ─────────────────────────────────────────────────

const ClassSectionSchema = z.object({
  classes: z.array(z.object({
    name: z.string().min(1),
    sections: z.array(z.string().min(1)),
  })).min(1, 'Add at least one class'),
});

export async function saveClassesAndSections(data: { classes: { name: string; sections: string[] }[] }) {
  const { tenantId } = await getAdminTenantId();

  const parsed = ClassSectionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  for (const cls of parsed.data.classes) {
    // Find or create class
    let classId: string | null = null;
    const { data: existingClass } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', cls.name)
      .maybeSingle();

    if (existingClass) {
      classId = existingClass.id;
    } else {
      const { data: newClass, error: classErr } = await supabaseAdmin
        .from('classes')
        .insert({ tenant_id: tenantId, name: cls.name })
        .select('id')
        .single();

      if (classErr || !newClass) {
        logger.error('onboarding: class insert failed', classErr, { tenantId, className: cls.name });
        continue;
      }
      classId = newClass.id;
    }

    // Insert sections (skip existing)
    for (const sectionName of cls.sections) {
      const { data: existingSec } = await supabaseAdmin
        .from('sections')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('class_id', classId)
        .eq('name', sectionName)
        .maybeSingle();

      if (!existingSec) {
        const { error: secErr } = await supabaseAdmin
          .from('sections')
          .insert({ tenant_id: tenantId, class_id: classId, name: sectionName });

        if (secErr) {
          logger.error('onboarding: section insert failed', secErr, { tenantId, sectionName });
        }
      }
    }
  }

  await advanceStep(tenantId, 4);
  revalidatePath('/', 'layout');
  return { success: true };
}

// ── Step 5: Staff Invites ──────────────────────────────────────────────────────

const StaffInviteSchema = z.object({
  invites: z.array(z.object({
    email: z.string().email('Invalid email'),
    role: z.enum(['teacher', 'staff', 'admin']),
  })).min(1, 'Add at least one invite'),
});

export async function sendStaffInvites(data: { invites: { email: string; role: string }[] }) {
  const { user, tenantId } = await getAdminTenantId();

  const parsed = StaffInviteSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  const results: { email: string; status: 'sent' | 'failed'; error?: string }[] = [];

  for (const invite of parsed.data.invites) {
    try {
      // Record invite
      const { error: inviteErr } = await supabaseAdmin
        .from('staff_invites')
        .upsert(
          { tenant_id: tenantId, email: invite.email, role: invite.role, invited_by: user.id },
          { onConflict: 'tenant_id,email' }
        );

      if (inviteErr) {
        logger.warn('onboarding: staff invite record failed', { email: invite.email, error: inviteErr.message });
      }

      // Generate invite link via Supabase magic link (safest approach — no password transmitted)
      const { error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: invite.email,
        options: {
          data: { role: invite.role, tenant_id: tenantId },
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });

      if (linkErr) throw new Error(linkErr.message);

      results.push({ email: invite.email, status: 'sent' });
    } catch (err: any) {
      logger.error('onboarding: staff invite failed', err, { email: invite.email });
      results.push({ email: invite.email, status: 'failed', error: 'Invite delivery failed' });
    }
  }

  await advanceStep(tenantId, 6);
  revalidatePath('/', 'layout');
  return { success: true, results };
}

// ── Step 6: Complete Onboarding ─────────────────────────────────────────────────

export async function completeOnboarding() {
  const { tenantId } = await getAdminTenantId();

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ onboarding_completed: true, onboarding_step: 6 })
    .eq('id', tenantId);

  if (error) {
    logger.error('onboarding: complete failed', error, { tenantId });
    return { success: false, error: 'Failed to complete onboarding' };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}

// ── Fetch current onboarding state ──────────────────────────────────────────────

export async function getOnboardingState() {
  const { tenantId } = await getAdminTenantId();

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('onboarding_step, onboarding_completed, name, city')
    .eq('id', tenantId)
    .single();

  if (error) return { step: 1, completed: false, tenantName: '' };
  return {
    step: data.onboarding_step ?? 1,
    completed: data.onboarding_completed ?? false,
    tenantName: data.name ?? '',
  };
}
