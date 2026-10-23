import { getSettings } from '../config.js';

// Approval policy. Each tool has a category; Settings → Agent decides per category:
//   ask   → show an approval card and wait for the user
//   auto  → run immediately
//   block → never run
// The autonomy level shifts the table:
//   supervised → every non-read action asks
//   balanced   → use the table as is (default)
//   autonomous → "ask" becomes "auto", except payments and messages (always ask)
export const CATEGORIES = {
  messages: 'Send emails & messages',
  payments: 'Payments & purchases',
  shell: 'Run commands',
  files_write: 'Write & delete files',
  files_read: 'Read files',
  network: 'Web & HTTP requests',
  device: 'Control devices (open apps, screenshots)',
  mcp: 'Connected services (MCP)',
};

const READ_ONLY = new Set(['files_read', 'network', 'auto']);

export function decide(category) {
  if (!category || category === 'auto') return 'auto';
  const a = getSettings().agent;
  let d = a.approvals?.[category] || 'ask';
  if (d === 'block') return 'block';
  if (a.autonomy === 'supervised' && !READ_ONLY.has(category)) d = 'ask';
  if (a.autonomy === 'autonomous' && d === 'ask' && !['payments', 'messages'].includes(category)) d = 'auto';
  return d;
}
