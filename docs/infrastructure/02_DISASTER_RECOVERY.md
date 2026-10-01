# EduSentrix Disaster Recovery

Last updated: 2026-10-01

DO NOT store credentials or secrets here.

---

# Recovery Objective

EduSentrix should be recoverable without depending on the original
Hetzner server surviving.

The production server should be treated as replaceable compute.

---

# Critical External Assets

## Source Code

Stored in GitHub.

Required:

- repository
- infrastructure branch
- production branch
- Docker configuration

---

## DNS

Provider:
Cloudflare

Zone:
tryedusentrix.app

DNS configuration should be documented separately.

---

## Database

Provider:
MongoDB Atlas

Database backups must eventually exist outside the Hetzner server.

---

## Files

Provider:
Cloudflare R2

No critical uploaded files should exist exclusively inside a Docker
container or Hetzner local filesystem.

---

## Coolify

Configuration:

/data/coolify/source/.env

External backup:

~/coolify-appsentrix-prod-01.env.backup

The APP_KEY is critical for restoring encrypted Coolify credentials.

---

# Scenario: Hetzner Server Dies

1. Create replacement Hetzner server.
2. Install Ubuntu LTS.
3. Configure firewall.
4. Install Coolify.
5. Restore required Coolify configuration.
6. Reconnect GitHub.
7. Deploy EduSentrix.
8. Restore environment variables.
9. Verify MongoDB connectivity.
10. Verify R2 connectivity.
11. Update Cloudflare origin IP.
12. Test application.
13. Restore worker services.
14. Verify external integrations.

Because MongoDB and R2 are external, application data should survive
server replacement.

---

# Scenario: Coolify Fails But Server Works

First inspect:

docker ps -a

Check Coolify containers.

Do not delete /data/coolify without a verified recovery plan.

Use Coolify's documented recovery procedure and retained APP_KEY.

Existing application Docker containers may continue to run even when
the Coolify management UI is unavailable.

---

# Scenario: Bad Application Deployment

Do not immediately modify DNS.

Use Coolify deployment history to roll back to the previous known-good
deployment.

Verify:

- authentication
- database
- uploads
- dashboards
- external integrations

before declaring recovery complete.

---

# Scenario: MongoDB Failure

Do not attempt destructive recovery without confirming backup state.

Determine whether failure is:

- application credentials
- network access
- Atlas service
- cluster suspension
- malformed migration
- accidental data mutation

Restore from a known backup when required.

---

# Scenario: Lost Administrator Mac

Required recovery materials:

- Hetzner account access
- Cloudflare account access
- Coolify administrator access
- password manager
- SSH recovery/private keys
- 2FA recovery information

SSH keys should eventually have a secure backup/recovery strategy.

---

# Recovery Verification

At least periodically test:

- server replacement procedure
- MongoDB backup restoration
- R2 access
- Coolify backup integrity
- Git deployment
- DNS modification procedure
