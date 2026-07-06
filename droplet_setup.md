# Setting up the droplet from scratch

This is the missing piece behind last time's Caddy/PM2/GitHub Actions files — those all assumed a server already existed. This walks through provisioning that server: a single DigitalOcean droplet, hardened and ready to run `diorama-homepage` (and, per the Caddyfile's modular structure, any future apps alongside it).

**Decisions made below, and why:**

| Choice | Value | Why |
|---|---|---|
| Image | Ubuntu 24.04 LTS | See note below — 26.04 exists but I'd wait |
| Size | 2 GB RAM / 1 vCPU (shared CPU, "Basic") | Enough for Caddy + a couple of small Node apps; resize later without a rebuild |
| Region | London (LON1) | You're UK-based with UK clients — lowest latency |
| Node.js | 24.x via NodeSource | Current Active LTS (Astro 6 only *requires* 22.12+, but 24 is the better default for anything new right now) |
| Process manager | PM2 | Matches `ecosystem.config.cjs` from last time and what you've used before |
| Deploy path | `/var/www/diorama-homepage` | Matches `DEPLOY_PATH` in `ci-cd.yml` |
| Domain | `dioramaconsulting.co.uk` | Confirmed against your actual content — it's what every internal link in the FAQ/blog/teaching pages already points to |

**On Ubuntu 26.04 vs 24.04:** 26.04 LTS ("Resolute Raccoon") is real and DigitalOcean does have the image available now. But it only shipped in April this year, and even DigitalOcean's own community guidance right now is that the first point release — 26.04.1, due in August — is the safer moment to move production workloads over, since point releases iron out the rough edges of a brand-new LTS. 24.04 is fully supported until 2029, so there's no cost to staying put for a few more months. If you'd rather be on the newest thing, everything below works the same on 26.04 — just swap the image.

Every command below assumes you're pasting into a terminal on your own machine (for the parts before you SSH in) or into an SSH session on the droplet (everything after step 2).

---

## 1. Create the droplet

In the DigitalOcean control panel: **Create → Droplets**.

- **Region**: London
- **Image**: Ubuntu 24.04 (LTS) x64
- **Size**: Basic → Regular (shared CPU) → the 2 GB RAM / 1 vCPU tier
- **Authentication**: SSH key, not password. If you don't already have a key you want to use for this box:
  ```bash
  ssh-keygen -t ed25519 -C "paolo@diorama-droplet"
  cat ~/.ssh/id_ed25519.pub
  ```
  Paste the output into DigitalOcean's "New SSH Key" field before creating the droplet — this seeds `root`'s `~/.ssh/authorized_keys` automatically.
- **Hostname**: something you'll recognise later, e.g. `diorama-box`
- **Backups**: worth turning on for a production box — weekly snapshots, cheap insurance
- **Monitoring**: free, turn it on — gives you CPU/memory/disk graphs and lets you set alerts later

Create it, then copy the droplet's public IP address from the control panel — you'll need it constantly below. I'll write it as `YOUR_DROPLET_IP`.

---

## 2. First login, updates, and a non-root user

```bash
ssh root@YOUR_DROPLET_IP
```

Update everything before touching anything else:

```bash
apt update && apt upgrade -y
# reboot if that pulled in a new kernel
reboot
```

Wait ~30 seconds, reconnect (`ssh root@YOUR_DROPLET_IP`), then create the user that will own and run everything from here on — this matches the `User=deploy` in last time's systemd file and the `cwd` in `ecosystem.config.cjs`:

```bash
adduser deploy          # set a password when prompted (only used for local sudo prompts, never over SSH)
usermod -aG sudo deploy
```

Give `deploy` the same SSH key access root has:

```bash
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Open a **new** terminal window (keep the root session open in case anything below goes wrong) and confirm this worked before proceeding:

```bash
ssh deploy@YOUR_DROPLET_IP
sudo whoami   # should print "root"
```

---

## 3. Lock down SSH

Still as `deploy` (or root, either works for this), edit the SSH daemon config:

```bash
sudo nano /etc/ssh/sshd_config
```

Set (or uncomment and change) these two lines:

```
PermitRootLogin no
PasswordAuthentication no
```

Save, then restart SSH. On Ubuntu 24.04, the unit is `ssh`, not `sshd` — using the wrong name here is a common mistake that silently does nothing:

```bash
sudo systemctl restart ssh
```

Before closing your root session, open one more **new** terminal and confirm:

```bash
ssh root@YOUR_DROPLET_IP        # should now be refused
ssh deploy@YOUR_DROPLET_IP      # should still work
```

Only close the original root session once both of those behave as expected.

---

## 4. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp    # HTTP/3 — Caddy uses this if the client supports it
sudo ufw enable           # confirm with 'y'
sudo ufw status verbose
```

Notice there's no rule for port 4321 (the app's port) — `ufw`'s default is deny-incoming for anything not explicitly allowed, so it's blocked automatically. That's the firewall layer; `ecosystem.config.cjs` also binds the app to `127.0.0.1` rather than `0.0.0.0` as a second, independent layer, so it's unreachable directly even from another box on the same network.

---

## 5. Basic hygiene (5 minutes, worth doing now rather than after something goes wrong)

**Swap** — a 2 GB droplet has no swap by default, and a `npm ci --omit=dev` alongside a couple of running Node processes can spike memory:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

**Automatic security patches:**

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades   # choose "Yes"
```

**Brute-force protection for SSH** (optional but cheap — works out of the box, no config needed):

```bash
sudo apt install -y fail2ban
sudo fail2ban-client status sshd
```

---

## 6. Install Node.js 24

```bash
sudo apt install -y curl ca-certificates gnupg build-essential
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

NODE_MAJOR=24
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

sudo apt update
sudo apt install -y nodejs

node -v   # expect v24.x.x
npm -v
```

`build-essential` is there for any npm package with a native addon (Astro's image optimisation pulls in Sharp, which sometimes needs it during install even though it ships prebuilt binaries for most platforms) — cheap insurance, worth having upfront rather than debugging a `node-gyp` failure later.

---

## 7. Install PM2

```bash
sudo npm install -g pm2
pm2 startup
```

That last command prints a `sudo env PATH=... pm2 startup systemd -u deploy --hp /home/deploy` line — **copy and run exactly what it prints** (it varies per-system), which hooks PM2 into systemd so it survives reboots. You'll run `pm2 save` after the app is actually running in step 10, to persist the process list.

*(If you'd rather skip PM2 entirely and use the `diorama-homepage.service` systemd unit from last time instead, skip this step and step 10's `pm2` commands — install it directly with `sudo cp diorama-homepage.service /etc/systemd/system/` once the code is deployed, per the comments in that file.)*

---

## 8. Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list

sudo apt update
sudo apt install -y caddy

caddy version
sudo systemctl status caddy   # should show "active (running)" already — the package starts it automatically
```

Caddy installs its own systemd service, runs as its own unprivileged `caddy` user, and manages its own TLS certificates — nothing else to configure yet.

---

## 9. Prepare the app directory and DNS

```bash
sudo mkdir -p /var/www/diorama-homepage
sudo chown deploy:deploy /var/www/diorama-homepage
```

In whichever registrar/DNS host manages `dioramaconsulting.co.uk`, add:

| Type | Name | Value |
|---|---|---|
| A | `@` | `YOUR_DROPLET_IP` |
| A | `www` | `YOUR_DROPLET_IP` |

(Add `AAAA` records too if the droplet has IPv6 enabled.) DNS propagation is usually minutes, sometimes longer — check with `dig dioramaconsulting.co.uk +short` before moving on; it should return `YOUR_DROPLET_IP`.

---

## 10. Set up the GitHub Actions deploy key

This is a **separate, dedicated key** from the one you used to create the droplet — so GitHub's copy can be revoked independently without ever touching your own access. Generate it **on your own machine**, not the droplet:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/diorama_deploy -N ""
```

Add the **public** half to the droplet:

```bash
cat ~/.ssh/diorama_deploy.pub | ssh deploy@YOUR_DROPLET_IP 'cat >> ~/.ssh/authorized_keys'
```

Test it works before trusting it in CI:

```bash
ssh -i ~/.ssh/diorama_deploy deploy@YOUR_DROPLET_IP "echo it works"
```

Then in the GitHub repo (**Settings → Secrets and variables → Actions → New repository secret**), add:

- `DEPLOY_SSH_KEY` — the full contents of `~/.ssh/diorama_deploy` (the **private** key — `cat ~/.ssh/diorama_deploy`)
- `DEPLOY_HOST` — `YOUR_DROPLET_IP` (or the domain, once DNS is live)
- `DEPLOY_USER` — `deploy`
- `DEPLOY_PATH` — `/var/www/diorama-homepage`

---

## 11. Wire in the Caddyfile and confirm HTTPS before deploying anything

```bash
sudo mkdir -p /etc/caddy/sites
sudo nano /etc/caddy/Caddyfile
```

Replace its contents with just:

```caddyfile
{
	email you@dioramaconsulting.co.uk
}

import sites/*.caddy
```

Then create `/etc/caddy/sites/diorama.caddy` with the subdomain block from `deploy/Caddyfile.example` (Option A):

```bash
sudo nano /etc/caddy/sites/diorama.caddy
```

```caddyfile
dioramaconsulting.co.uk, www.dioramaconsulting.co.uk {
	reverse_proxy 127.0.0.1:4321 {
		header_up X-Real-IP {remote_host}
	}
	encode gzip zstd
	log {
		output file /var/log/caddy/diorama-access.log
	}
}
```

Validate before reloading — this catches typos without risking downtime:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Visit `https://dioramaconsulting.co.uk` now. You should get a **502 Bad Gateway** — over a real, valid HTTPS connection. That's actually the right result at this stage: it proves DNS, Caddy, and Let's Encrypt are all working; there's just nothing running on port 4321 yet.

---

## 12. First deploy

Everything is now in place for `.github/workflows/ci-cd.yml` from last time to work end to end. Either:

- push a commit to `main` (or save something in Keystatic) and watch it run under the repo's **Actions** tab, or
- trigger it manually via **Actions → CI/CD → Run workflow** (that's what `workflow_dispatch` in the workflow file is for)

The first run will rsync the build to `/var/www/diorama-homepage` and SSH in to run `npm ci --omit=dev` and `pm2 reload diorama-homepage` — which will fail the very first time only, because the process doesn't exist yet for PM2 to reload. SSH in once to start it manually:

```bash
ssh deploy@YOUR_DROPLET_IP
cd /var/www/diorama-homepage
# create .env here first (chmod 600), with ANTHROPIC_API_KEY / DATABASE_URL / RESEND_API_KEY — see .env.example
pm2 start ecosystem.config.cjs
pm2 save
```

From then on, every future push redeploys through `pm2 reload`, and PM2 already knows about the process. Reload `https://dioramaconsulting.co.uk` — the 502 should now be the real site.

---

## Quick reference

| What | Where |
|---|---|
| App code | `/var/www/diorama-homepage` |
| App env vars | `/var/www/diorama-homepage/.env` (chmod 600, never in git) |
| Caddy config | `/etc/caddy/Caddyfile` (imports `/etc/caddy/sites/*.caddy`) |
| Caddy logs | `/var/log/caddy/diorama-access.log`, or `sudo journalctl -u caddy -f` |
| App logs | `pm2 logs diorama-homepage` |
| Restart the app | `pm2 reload diorama-homepage` |
| Restart Caddy after a config change | `sudo systemctl reload caddy` |
| Add another app later | New `/etc/caddy/sites/<name>.caddy` block on a new port + a new PM2 entry — see the port table in `Caddyfile.example` |