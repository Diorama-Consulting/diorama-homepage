// deploy/ecosystem.config.cjs
//
// Usage on the server (see also .github/workflows/ci-cd.yml, which reloads
// this after every deploy):
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save                 # persist the process list
//   pm2 startup              # generate + run the systemd hook so PM2 (and
//                             # this app) comes back up after a reboot
//
// If you'd rather avoid the extra `pm2` global dependency and use plain
// systemd instead, see deploy/diorama-homepage.service for an equivalent —
// pick one, you don't need both.
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
        // Secrets below are intentionally NOT hardcoded here — this file is
        // committed to the repo. Set the real values in a .env file at
        // /var/www/diorama-homepage/.env (chmod 600, not in git) and either
        //   (a) load it with `pm2 start ... --env-file .env`, or
        //   (b) `require('dotenv').config()` at the very top of a thin
        //       wrapper script you point `script:` at instead.
        // Either way, ANTHROPIC_API_KEY / DATABASE_URL / RESEND_API_KEY need
        // to exist in the process's environment before entry.mjs starts.
      },
    },
  ],
};