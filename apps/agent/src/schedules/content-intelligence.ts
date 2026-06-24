import { defineWorkflow, defineAgent } from '@flue/runtime';
import * as v from 'valibot';
import { conversationAnalystProfile } from '../subagents/conversation-analyst/index.ts';

const analystAgent = defineAgent(() => ({
  model: 'openai/gpt-4.1-mini',
  subagents: [conversationAnalystProfile],
}));

export default defineWorkflow({
  agent: analystAgent,
  input: v.object({
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  }),
  async run({ harness, input }) {
    const session = await harness.session();
    const result = await session.task(
      `Run content intelligence. Analyze conversations from ${input.from || 'last week'} to ${input.to || 'now'}. Extract topics, objections, and content opportunities.`,
      { agent: 'conversation_analyst' },
    );
    return JSON.parse(JSON.stringify({ result: result.text }));
  },
});
