# EduSentrix Infrastructure Overview

Last updated: 2026-10-01

## Purpose

This document describes the production infrastructure used to run EduSentrix.

DO NOT place passwords, API keys, private SSH keys, recovery codes,
database credentials, or other secrets in this document.

---

## Architecture

Internet
|
v
Cloudflare

- DNS
- CDN
- SSL
- WAF
- DDoS protection
  |
  v
  Hetzner Cloud
- Server: appsentrix-prod-01
- Ubuntu 24.04 LTS
- Coolify
  |
  +-- EduSentrix Web
  |
  +-- EduSentrix Worker (planned)
  |
  +--> MongoDB Atlas
  +--> Cloudflare R2
  +--> Clerk
  +--> Paystack
  +--> Email provider
  +--> LiveKit
  +--> Inngest (planned)

---

## Domain

Primary domain:
tryedusentrix.app

Registrar:
Vercel

DNS provider:
Cloudflare

Cloudflare plan:
Free

Domain registration transfer:
Deferred. DNS is already managed by Cloudflare.

Coolify management hostname:
ops.tryedusentrix.app

---

## Hetzner

Project:
Appsentrix Production

Server:
appsentrix-prod-01

Server type:
CX23

CPU:
2 vCPU

RAM:
4 GB

Disk:
40 GB SSD

Operating system:
Ubuntu 24.04 LTS

Region:
Nuremberg, Germany

Public IPv4:
49.13.228.58

Public IPv6:
See Hetzner console.

Firewall:
appsentrix-prod-firewall

Persistent application data must NOT depend on the local server disk.

---

## Coolify

Deployment platform:
Self-hosted Coolify

Installed on:
appsentrix-prod-01

Coolify server resource:
localhost

Current management address during bootstrap:
http://49.13.228.58:8000

Target management address:
https://ops.tryedusentrix.app

Coolify configuration location:
/data/coolify/source/.env

The Coolify APP_KEY and complete .env backup must be stored securely
outside the production server.

---

## SSH

Production SSH user:
root

Server:
49.13.228.58

Private key location on primary Mac:
~/.ssh/appsentrix_hetzner

Public key:
~/.ssh/appsentrix_hetzner.pub

Connection:

ssh -i ~/.ssh/appsentrix_hetzner root@49.13.228.58

IMPORTANT:
The private SSH key must never be committed to Git.

---

## Database

Provider:
MongoDB Atlas

Target deployment:
External to Hetzner

Initial tier:
Free tier where capacity permits

Production database must remain outside individual web containers.

---

## Object Storage

Provider:
Cloudflare R2

Purpose:

- parent documents
- general uploaded documents
- generated exports
- generated reports
- future durable file storage

Application containers must not store irreplaceable files locally.

---

## Background Work

Provider:
Inngest

Status:
Planned

Architecture:

EduSentrix Web
|
+--> quick request/response work
|
+--> Background Work Engine
|
v
Inngest
|
v
Worker container

Worker development will occur after the base infrastructure is stable.

---

## Horizontal Scaling Goal

The architecture must support:

Cloudflare
|
Load Balancer
|
+----+----+
| | |
Web1 Web2 Web3
| | |
+----+----+
|
Shared external services

Shared state:

- MongoDB
- R2
- Clerk
- Inngest
- Redis if eventually required

Web containers should be replaceable and disposable.
