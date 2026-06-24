import { createFlueClient } from '@flue/sdk';
import { getAgentHost } from '@/lib/agent-host';

let client: ReturnType<typeof createFlueClient> | null = null;

function getFlueClient() {
  if (!client) {
    const host = getAgentHost();
    client = createFlueClient({ baseUrl: host });
  }
  return client;
}

export { getFlueClient };
