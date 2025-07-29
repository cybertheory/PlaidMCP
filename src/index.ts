import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import axios, { AxiosRequestConfig } from "axios";
import { z } from "zod";

// Configuration will be set from session config
let PLAID_ENV = "sandbox";
let BASE_URL = "https://sandbox.plaid.com";
let PLAID_CLIENT_ID: string | undefined;
let PLAID_SECRET: string | undefined;

// Helper for Plaid API calls
type HttpMethod = 'get' | 'post' | 'put' | 'delete';
async function plaidRequest<T>(
  path: string,
  body: Record<string, unknown> = {},
  method: HttpMethod = 'post',
  timeoutMs?: number
): Promise<T> {
  if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
    throw new Error("Plaid credentials not configured. Please provide plaidClientId and plaidSecret in the session configuration.");
  }

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const requestData = { client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, ...body };
  const config: AxiosRequestConfig = { method, url, headers, data: requestData };
  if (timeoutMs) config.timeout = timeoutMs;

  console.log(`[PLAID] ${method.toUpperCase()} ${url}`);
  console.log(`[PLAID] Request body:`, { ...requestData, secret: '[REDACTED]', client_id: PLAID_CLIENT_ID?.substring(0, 10) + '...' });

  try {
    const response = await axios.request<T>(config);
    console.log(`[PLAID] Response status: ${response.status}`);
    console.log(`[PLAID] Response data:`, JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.error(`[PLAID] Request failed:`, error.response?.status, error.response?.data || error.message);
    throw error;
  }
}

export default function createPlaidMcpServer() {
  const server = new McpServer({
    name: 'plaid',
    version: '1.0.0',
    async configurationChanged(config) {
      PLAID_CLIENT_ID = config.plaidClientId;
      PLAID_SECRET = config.plaidSecret;
      PLAID_ENV = (config.plaidEnv || 'sandbox').toLowerCase();
      BASE_URL = config.plaidBaseUrl || (PLAID_ENV === 'sandbox'
        ? 'https://sandbox.plaid.com'
        : 'https://production.plaid.com');
    }
  });

  // Item operations
  server.registerTool(
    'get_item',
    {
      description: "Get an Item",
      inputSchema: {
        access_token: z.string().describe('Plaid Item access token'),
      }
    },
    async ({ access_token }) => {
      const result = await plaidRequest('/item/get', { access_token });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    'remove_item',
    {
      description: "Remove an Item",
      inputSchema: {
        access_token: z.string().describe('Plaid Item access token'),
      }
    },
    async ({ access_token }) => {
      const result = await plaidRequest('/item/remove', { access_token });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Accounts & balances
  server.registerTool(
    'get_accounts',
    {
      description: "Retrieve an Item's accounts",
      inputSchema: {
        access_token: z.string().describe('Plaid Item access token'),
      }
    },
    async ({ access_token }) => {
      const result = await plaidRequest('/accounts/get', { access_token });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    'get_balances',
    {
      description: "Retrieve current balances for an Item's accounts",
      inputSchema: {
        access_token: z.string().describe('Plaid Item access token'),
      }
    },
    async ({ access_token }) => {
      const result = await plaidRequest('/accounts/balance/get', { access_token });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Identity
  server.registerTool(
    'get_identity',
    {
      description: "Retrieve identity data",
      inputSchema: {
        access_token: z.string().describe('Plaid Item access token'),
      }
    },
    async ({ access_token }) => {
      const result = await plaidRequest('/identity/get', { access_token });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Transactions
  server.registerTool(
    'get_transactions',
    {
      description: "Retrieve transactions in a date range",
      inputSchema: {
        access_token: z.string().describe('Plaid Item access token'),
        start_date:   z.string().describe('Start of date range, YYYY-MM-DD'),
        end_date:     z.string().describe('End of date range, YYYY-MM-DD'),
        options:      z.record(z.unknown()).optional().describe('Additional request options'),
      }
    },
    async ({ access_token, start_date, end_date, options }) => {
      const result = await plaidRequest('/transactions/get', { access_token, start_date, end_date, options }, 'post', 30000);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    'sync_transactions',
    {
      description: "Sync transactions since last cursor",
      inputSchema: {
        access_token: z.string().describe('Plaid Item access token'),
        cursor:       z.string().optional().describe('Cursor from previous sync'),
        count:        z.number().optional().describe('Max number of transactions to return'),
      }
    },
    async ({ access_token, cursor, count }) => {
      const result = await plaidRequest('/transactions/sync', { access_token, cursor, count }, 'post', 30000);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
