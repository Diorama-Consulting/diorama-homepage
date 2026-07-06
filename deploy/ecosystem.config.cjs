// deploy/ecosystem.config.cjs
//
// Usage on the server (see also .github/workflows/ci-cd.yml, which reloads
// this after every deploy):
//   pm2 start ecosystem.config.cjs      (run from /var/www/diorama-homepage —
//                                        rsync flattens deploy/ecosystem.config.cjs
//                                        to the deploy path root, no subfolder)
//   pm2 save                 # persist the process list
//   pm2 startup              # generate + run the systemd hook so PM2 (and
//                             # this app) comes back up after a reboot
//
// If you'd rather avoid the extra `pm2` global dependency and use plain
// systemd instead, see deploy/diorama-homepage.service for an equivalent —
// pick one, you don't need both.
//
// Loading .env: PM2 does NOT read a .env file automatically, and
// `pm2 start ... --env-file .env` is NOT a real flag on PM2 7.x — confirmed
// directly, it errors with "unknown option" and the app never starts. The
// reliable approach, tested working on both `pm2 start` and `pm2 reload`,
// is having this config file load it itself via the `dotenv` package.
// Requires: npm install dotenv
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'diorama-homepage',
      script: './dist/server/entry.mjs',
      cwd: '/var/www/diorama-homepage', // matches DEPLOY_PATH in the GitHub Actions secret
      exec_mode: 'fork', // @astrojs/node's standalone server isn't cluster-aware
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1', // only Caddy talks to this — see Caddyfile.example
        PORT: 4321,
        // Pulled from .env via dotenv above, then passed through explicitly —
        // PM2 only forwards env vars that are actually listed here.
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        DATABASE_URL: process.env.DATABASE_URL,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
      },
    },
  ],
};
