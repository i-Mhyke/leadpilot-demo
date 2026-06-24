import { dispatch } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { registerObservability } from './instrumentation.ts';
import { parseClientContextHeader } from './agent/lib/client-context.ts';
import { logLeadPilotEvent } from './agent/lib/observability.ts';

registerObservability();

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, service: 'leadpilot-flue' }));

app.options('/api/leadpilot/chat', (c) => {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, x-leadpilot-client-context', 'Access-Control-Max-Age': '86400' } });
});

app.post('/api/leadpilot/chat', async (c) => {
  const clientContext = parseClientContextHeader(c.req.raw);
  const firmSlug = clientContext?.firmSlug || process.env.LEADPILOT_DEV_FIRM_SLUG?.trim() || '';
  const browserSessionId = clientContext?.browserSessionId || `browser:${crypto.randomUUID()}`;

  if (!firmSlug) return c.json({ error: 'Missing firm context' }, 400);

  let body: { message?: string };
  try { body = await c.req.json<{ message?: string }>(); }
  catch { return c.json({ error: 'Invalid JSON body' }, 400); }
  if (!body.message) return c.json({ error: 'Message is required' }, 400);

  const agentId = `${firmSlug}/${browserSessionId}`;
  const streamUrl = `/agents/leadpilot/${encodeURIComponent(agentId)}`;

  try {
    const receipt = await dispatch({ agent: 'leadpilot', id: agentId, input: { type: 'chat.message', message: body.message, firmSlug, browserSessionId } });
    logLeadPilotEvent("chat.dispatched", { firmSlug, dispatchId: receipt.dispatchId });
    return c.json({ ok: true, dispatchId: receipt.dispatchId, acceptedAt: receipt.acceptedAt, streamUrl, agentId, instruction: `Use GET ${streamUrl}?offset=-1&live=sse to stream` }, 201);
  } catch (error) {
    logLeadPilotEvent("chat.error", { error: error instanceof Error ? error.message : String(error) }, "error");
    return c.json({ error: 'Failed to dispatch' }, 500);
  }
});

app.route('/', flue());
export default app;
