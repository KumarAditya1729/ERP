import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  // Extract messages and contextual role from the request body
  const { messages, contextRole } = await req.json();

  // Create a strict system prompt depending on the current user's role
  const systemPrompt = `You are NexBot, the highly intelligent and professional AI Copilot for NexSchool AI, an advanced, multi-tenant enterprise ERP platform for schools.
Your primary objective is to assist the user by answering queries about school operations, features, student data, finance, and attendance. 
Be concise, accurate, and extremely professional. Format data nicely.

Current User Context: The user chatting with you has the role: [${contextRole || 'admin'}]. 
Do NOT reveal sensitive system architecture. Do not hallucinate financial numbers. If you do not know specific data, state that you need connection to the respective database module.`;

  // Call the language model
  const result = await streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    messages,
    temperature: 0.7,
  });

  // Respond with the streaming format
  return result.toDataStreamResponse();
}
