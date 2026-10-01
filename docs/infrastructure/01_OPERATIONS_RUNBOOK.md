# EduSentrix Operations Runbook

Last updated: 2026-10-01

This document contains operational instructions.

DO NOT store secrets here.

---

# 1. SSH Into Production

From the authorized Mac:

ssh -i ~/.ssh/appsentrix_hetzner root@49.13.228.58

Expected prompt:

root@appsentrix-prod-01:~#

---

# 2. Verify Server Identity

hostname

Expected:

appsentrix-prod-01

---

# 3. Check Memory

free -h

---

# 4. Check Disk Usage

df -h

---

# 5. Check Docker Containers

docker ps

Detailed:

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

---

# 6. Coolify

Production Coolify hostname:

https://ops.tryedusentrix.app

Bootstrap/direct address:

http://49.13.228.58:8000

The direct address should eventually not be exposed publicly.

---

# 7. Coolify Configuration

Location:

/data/coolify/source/.env

Never print or share this file unnecessarily.

Never commit it to Git.

---

# 8. Coolify Backup Copy

Backup location on primary Mac:

~/coolify-appsentrix-prod-01.env.backup

Recommended permissions:

chmod 600 ~/coolify-appsentrix-prod-01.env.backup

---

# 9. Hetzner Firewall

Firewall:

appsentrix-prod-firewall

Public application ports:

80/tcp
443/tcp

Administrative/bootstrap ports:

22/tcp
8000/tcp
6001/tcp
6002/tcp

Ports 8000, 6001 and 6002 are temporary bootstrap exposure and should
be closed once Coolify is fully available through HTTPS.

SSH should eventually use restricted/private management access.

---

# 10. Current ISP IP

Do NOT treat the administrator's home/mobile public IP as permanent.

Check current IPv4:

curl -4 ifconfig.me

If SSH is restricted to an old IP, update the Hetzner firewall.

Long-term plan:
Use private administrative access such as Tailscale rather than
continually updating changing ISP IP addresses.

---

# 11. DNS

DNS provider:

Cloudflare

Primary zone:

tryedusentrix.app

Current management record:

ops.tryedusentrix.app
-> 49.13.228.58

Do not point the primary domain at a new deployment until the deployment
has first passed preview testing.

---

# 12. Deployment Strategy

Branches:

main
Stable application baseline

infra/coolify-cloudflare-r2
Infrastructure migration work

feature/background-work-engine-v1
Future background work engine

Infrastructure changes should be verified before Work Engine development.

---

# 13. Production Data Rules

Never depend on:

- container filesystem
- process memory
- one web server
- one worker instance

Durable state belongs in shared external systems.

Database:
MongoDB Atlas

Files:
Cloudflare R2

Identity:
Clerk

Background execution:
Inngest

---

# 14. Before Every Major Deployment

Confirm:

- Git branch is correct
- environment variables exist
- database target is correct
- backups exist
- disk usage is healthy
- RAM usage is healthy
- health endpoint works
- Cloudflare DNS is unchanged unless intentionally modifying DNS

---

# 15. After Every Major Deployment

Test:

- homepage
- login
- admin dashboard
- teacher dashboard
- parent dashboard
- database reads
- database writes
- uploads
- downloads
- email
- external integrations
- health endpoint

Check:

docker ps

and application logs in Coolify.
