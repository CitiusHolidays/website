import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';
import { systemPrompt } from './sysprompt';

export const maxDuration = 60;

// Initialize OpenRouter with the API key from environment variables
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

export async function POST(req) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured. Please add OPENROUTER_API_KEY to your environment variables.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { messages } = await req.json();

    // Convert messages to the format expected by the AI SDK
    const convertedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.parts?.[0]?.text || msg.content || '',
    }));

    const result = streamText({
      model: openrouter.chat('openai/gpt-oss-20b:free'),
      messages: convertedMessages,
      // Add system message for travel context
      system: systemPrompt,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
