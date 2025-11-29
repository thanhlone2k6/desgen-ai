# Deployment Guide

## Prerequisites

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

## Step 1: Create KV Namespaces

```bash
# Production namespace
wrangler kv:namespace create "USERS"

# Preview namespace (for dev)
wrangler kv:namespace create "USERS" --preview
```

Copy the IDs from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "DESGEN_KV"
id = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

## Step 2: Set Secrets

```bash
# Set API keys and JWT secret
wrangler secret put FREE_API_KEY
wrangler secret put VIP_API_KEY
wrangler secret put JWT_SECRET
```

When prompted, enter the values:
- `FREE_API_KEY`: Your Google Gemini API key for free users
- `VIP_API_KEY`: Your Google Gemini API key for VIP users
- `JWT_SECRET`: A strong random string (e.g., generate with `openssl rand -hex 32`)

## Step 3: (Optional) Set VIP Emails

```bash
wrangler kv:key put --binding=DESGEN_KV "vip_emails" '["admin@example.com","vip@example.com"]'
```

Or set via Wrangler dashboard.

## Step 4: Install Dependencies

```bash
cd worker
npm install
```

## Step 5: Test Locally

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

## Step 6: Deploy

```bash
npm run deploy
```

Your worker will be deployed to: `https://desgen-ai-worker.your-subdomain.workers.dev`

## Update Worker URL

After deployment, update your Electron app to use the worker URL instead of direct API calls.

