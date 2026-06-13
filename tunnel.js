// tunnel.js — expose the local Vite dev server publicly via ngrok (for demos).
//
// Usage:
//   1. Start the app first:  npm run dev   (client must be on port 5173)
//   2. In a second terminal:  npm run tunnel
//
// Requires an ngrok authtoken (free). Provide it either way:
//   - add NGROK_AUTHTOKEN=<token> to your .env, or
//   - run once globally:  npx ngrok config add-authtoken <token>
// Get a token at: https://dashboard.ngrok.com/get-started/your-authtoken

// Load .env if dotenv is available (it's optional at the repo root).
try {
  require('dotenv').config();
} catch {
  /* dotenv not installed here — fall back to process.env / global ngrok config */
}

const ngrok = require('ngrok');

const PORT = Number(process.env.TUNNEL_PORT) || 5173;
const AUTHTOKEN = process.env.NGROK_AUTHTOKEN;

async function start() {
  console.log(`Starting ngrok tunnel -> http://localhost:${PORT} ...`);

  const url = await ngrok.connect({
    addr: PORT,
    ...(AUTHTOKEN ? { authtoken: AUTHTOKEN } : {}),
  });

  console.log('\n========================================');
  console.log('  Public URL:  ' + url);
  console.log('  Forwarding:  http://localhost:' + PORT);
  console.log('========================================\n');
  console.log('Share the Public URL to demo DocFlow. Press Ctrl+C to stop.\n');
}

async function shutdown() {
  console.log('\nClosing tunnel...');
  try {
    await ngrok.disconnect();
    await ngrok.kill();
  } catch {
    /* already gone */
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  const raw = (err && (err.body || err.message)) || err;
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  console.error('\nFailed to start tunnel.');
  console.error(text);
  if (/authtoken|ERR_NGROK_4018|verified account/i.test(text)) {
    console.error(
      '\nThis looks like an authtoken problem. Get a free token at:\n' +
        '  https://dashboard.ngrok.com/get-started/your-authtoken\n' +
        'Then add NGROK_AUTHTOKEN=<token> to your .env, or run:\n' +
        '  npx ngrok config add-authtoken <token>\n'
    );
  }
  process.exit(1);
});
