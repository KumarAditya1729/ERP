import { requireAuth } from '@/lib/auth-guard';
import { apiRateLimit } from '@/lib/rate-limit';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const ChatRequestSchema = z.object({
  messages: z.array(z.any()).min(1).max(50),
});

export async function POST(req: Request) {
  const { user, role, tenantId, error: authErr } = await requireAuth([
    'admin',
    'teacher',
    'staff',
    'parent',
    'student',
    'warden',
  ]);
  if (authErr) return authErr;

  try {
    const { success } = await apiRateLimit.limit(`chat:${tenantId ?? 'unknown'}:${user.id}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many chat requests. Please try again shortly.' }, { status: 429 });
    }

    const body = ChatRequestSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Use authenticated user's role from JWT metadata, not from request body
    const userRole = role || 'parent';

    // Create a strict system prompt depending on the authenticated user's role
    const systemPrompt = `You are NexBot, the highly intelligent and professional AI Copilot for NexSchool AI, an advanced, multi-tenant enterprise ERP platform for schools.
Your primary objective is to assist the user by answering queries about school operations, features, student data, finance, and attendance. 
Be concise, accurate, and extremely professional. Format data nicely.

Current User Context: The authenticated user has the role: [${userRole}]. 
Do NOT reveal sensitive system architecture. Do not hallucinate financial numbers. If you do not know specific data, state that you need connection to the respective database module.`;

    // Call the language model
    if (!process.env.OPENAI_API_KEY) {
      // Fallback streaming response if no API key is provided
      const fallbackStream = new ReadableStream({
        async start(controller) {
          const text = "I am operating in Offline/Demo Mode because the `OPENAI_API_KEY` is not set in your environment variables. \n\nHowever, to answer common queries: \n- **Attendance:** If a student is marked absent, the system automatically triggers an SMS and app notification to the parents via the Communication module.\n- **Exams & Academics:** Use the respective dashboards to generate timetables and manage report cards.\n\nPlease add your OpenAI API key to `.env.local` to enable full GPT-4o-mini capabilities.";
          const chunks = text.split(' ');
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(`0:"${chunk} "\n`));
            await new Promise(r => setTimeout(r, 50));
          }
          controller.close();
        }
      });
      return new Response(fallbackStream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'x-vercel-ai-data-stream': 'v1'
        }
      });
    }

    const result = await streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: body.data.messages,
      temperature: 0.7,
    });

    // Respond with the streaming format
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
