#!/usr/bin/env node

import axios from 'axios';

const API_URL = process.env.ACTION_QUEUE_URL || 'http://localhost:3007';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error('Error: ADMIN_TOKEN environment variable is not set');
  console.error('Set it with: export ADMIN_TOKEN="your-token-here"');
  process.exit(1);
}

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const arg = args[1];

  try {
    switch (command) {
      case 'reset':
        if (!arg) {
          console.error('Usage: npm run recovery -- reset <agent-name>');
          process.exit(1);
        }
        const resetRes = await client.post(`/recovery/reset/${arg}`);
        console.log(`✓ ${resetRes.data.message}`);
        break;

      case 'status':
        if (!arg) {
          console.error('Usage: npm run recovery -- status <agent-name>');
          process.exit(1);
        }
        const statusRes = await client.get(`/recovery/status/${arg}`);
        console.log(`Agent: ${statusRes.data.agent_name}`);
        console.log(`State: ${statusRes.data.state}`);
        console.log(`Consecutive Failures: ${statusRes.data.consecutive_failures}`);
        console.log(`Last Failure: ${statusRes.data.last_failure_time || 'never'}`);
        console.log(`Opened At: ${statusRes.data.opened_at || 'never'}`);
        break;

      case 'probe':
        const probeRes = await client.post('/recovery/probe');
        console.log(`✓ ${probeRes.data.message}`);
        break;

      case 'orphaned':
        const orphanRes = await client.post('/recovery/orphaned/reclaim');
        console.log(`✓ Recovered ${orphanRes.data.recovered} orphaned actions`);
        break;

      default:
        console.error('Unknown command:', command);
        console.error('Available commands: reset, status, probe, orphaned');
        process.exit(1);
    }
  } catch (err: any) {
    console.error('Error:', err.response?.data?.error || err.message);
    process.exit(1);
  }
}

main();
