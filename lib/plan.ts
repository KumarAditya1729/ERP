import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface Plan {
  name: string
  studentLimit: number
  features: {
    aiCopilot: boolean
    bulkImport: boolean
    advancedReports: boolean
    smsNotifications: boolean
    multiBranch: boolean
    apiAccess: boolean
    customBranding: boolean
    prioritySupport: boolean
  }
}

export const plans: Record<string, Plan> = {
  basic: {
    name: 'Basic',
    studentLimit: 100,
    features: {
      aiCopilot: false,
      bulkImport: false,
      advancedReports: false,
      smsNotifications: false,
      multiBranch: false,
      apiAccess: false,
      customBranding: false,
      prioritySupport: false,
    },
  },
  pro: {
    name: 'Pro',
    studentLimit: 1000,
    features: {
      aiCopilot: true,
      bulkImport: true,
      advancedReports: true,
      smsNotifications: true,
      multiBranch: false,
      apiAccess: true,
      customBranding: false,
      prioritySupport: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    studentLimit: 5000,
    features: {
      aiCopilot: true,
      bulkImport: true,
      advancedReports: true,
      smsNotifications: true,
      multiBranch: true,
      apiAccess: true,
      customBranding: true,
      prioritySupport: true,
    },
  },
}

/**
 * Get tenant's current plan and subscription status
 */
export async function getTenantPlan(tenantId: string): Promise<{ plan: Plan; status: string } | null> {
  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('plan, subscription_status')
      .eq('id', tenantId)
      .single()

    if (error || !tenant) {
      console.error('Failed to get tenant plan:', error)
      return null
    }

    const plan = plans[tenant.plan || 'basic']
    return {
      plan,
      status: tenant.subscription_status || 'inactive',
    }
  } catch (error) {
    console.error('Error getting tenant plan:', error)
    return null
  }
}

/**
 * Check if tenant has access to a specific feature
 */
export async function hasFeatureAccess(
  tenantId: string, 
  feature: keyof Plan['features']
): Promise<boolean> {
  const tenantPlan = await getTenantPlan(tenantId)
  
  if (!tenantPlan || tenantPlan.status !== 'active') {
    return false
  }

  return tenantPlan.plan.features[feature]
}

/**
 * Check if tenant can add more students
 */
export async function canAddStudents(
  tenantId: string, 
  additionalCount: number
): Promise<{ canAdd: boolean; current: number; limit: number; remaining: number }> {
  try {
    const tenantPlan = await getTenantPlan(tenantId)
    
    if (!tenantPlan || tenantPlan.status !== 'active') {
      return { canAdd: false, current: 0, limit: 0, remaining: 0 }
    }

    // Count current students
    const { data: students, error } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('Failed to count students:', error)
      return { canAdd: false, current: 0, limit: 0, remaining: 0 }
    }

    const current = students?.length || 0
    const limit = tenantPlan.plan.studentLimit
    const remaining = Math.max(0, limit - current)
    const canAdd = remaining >= additionalCount

    return { canAdd, current, limit, remaining }
  } catch (error) {
    console.error('Error checking student limits:', error)
    return { canAdd: false, current: 0, limit: 0, remaining: 0 }
  }
}

/**
 * Middleware helper to enforce plan limits
 */
export function enforcePlanLimits(plan: Plan, status: string) {
  return {
    isActive: status === 'active',
    canUseAI: plan.features.aiCopilot && status === 'active',
    canBulkImport: plan.features.bulkImport && status === 'active',
    canSendSMS: plan.features.smsNotifications && status === 'active',
    canAccessAPI: plan.features.apiAccess && status === 'active',
    studentLimit: plan.studentLimit,
  }
}
