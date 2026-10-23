// Command-line helpers:  npm run reset-password -- <new password>
import { setPassword } from './auth.js';

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'reset-password') {
  if (!arg) { console.error('Usage: npm run reset-password -- <new password>'); process.exit(1); }
  setPassword(arg);
  console.log('Password updated. All sessions were signed out.');
} else {
  console.log('Commands:\n  reset-password <new password>');
}
