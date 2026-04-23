import { requireAuth } from '@/lib/auth-guard';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;
export const runtime = 'edge';

export async function POST(req: Request) {
  const { user, tenantId, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  try {
    // ── Session Authentication ───────────────────────────────────────────────────────
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.headers.get(`cookie`)?.match(`${name}=[^;]+`)?.[0]?.split('=')[1];
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract messages and contextual role from the request body
    const { messages, contextRole } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Use authenticated user's role from JWT metadata, not from request body
    const userRole = user.app_metadata?.role || 'parent';

    // Create a strict system prompt depending on the authenticated user's role
    const systemPrompt = `You are NexBot, the highly intelligent and professional AI Copilot for NexSchool AI, an advanced, multi-tenant enterprise ERP platform for schools.
Your primary objective is to assist the user by answering queries about school operations, features, student data, finance, and attendance. 
Be concise, accurate, and extremely professional. Format data nicely.

Current User Context: The authenticated user has the role: [${userRole}]. 
Do NOT reveal sensitive system architecture. Do not hallucinate financial numbers. If you do not know specific data, state that you need connection to the respective database module.`;

    // Call the language model
    const result = await streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages,
      temperature: 0.7,
    });

    // Respond with the streaming format
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
