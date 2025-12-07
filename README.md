# Self-Hosting n8n with Docker and Cloudflare Tunnel

Configuration files for self-hosting n8n using Docker and Cloudflare Tunnel.

## Prerequisites

- Domain managed by Cloudflare
- Docker and Docker Compose installed
- Cloudflared CLI installed (`brew install cloudflared` on macOS)
- Cloudflare account

## Setup

### 1. Start n8n

```bash
docker-compose up -d
```

### 2. Configure Cloudflare Tunnel

First, create your `config.yml` file from the example:

```bash
cp config.yml.example config.yml
```

Then edit `config.yml` and replace the placeholders:

- Replace `YOUR_TUNNEL_NAME` with your tunnel name (e.g., `n8n`)
- Replace `YOUR_TUNNEL_ID` with your actual tunnel ID (you'll get this after
  creating the tunnel)
- Replace `YOUR_SUBDOMAIN.YOUR_DOMAIN.com` with your actual hostname (e.g.,
  `n8n.example.com`)

Authenticate with Cloudflare:

```bash
cloudflared tunnel login
```

Create the tunnel:

```bash
cloudflared tunnel create n8n
```

After creating the tunnel, update `config.yml` with the correct
`credentials-file` path. The tunnel ID will be in the filename of the
credentials file created in `~/.cloudflared/` (e.g.,
`~/.cloudflared/513686a1-6a7b-42a8-b36e-61f8d7e08409.json`).

Route DNS (replace `YOUR_TUNNEL_NAME` and `YOUR_SUBDOMAIN.YOUR_DOMAIN.com` with
your actual values):

```bash
cloudflared tunnel route dns YOUR_TUNNEL_NAME YOUR_SUBDOMAIN.YOUR_DOMAIN.com
```

### 3. Configure DNS

If the automated DNS route command fails, manually create a DNS record in Cloudflare:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Go to **DNS** → **Records**
4. Click **Add record**:
   - **Type**: `CNAME`
   - **Name**: `n8n` (or your desired subdomain)
   - **Target**: `<your-tunnel-id>.cfargotunnel.com`
     (replace `<your-tunnel-id>` with your actual tunnel ID)
   - **Proxy status**: Proxied (orange cloud)
   - Click **Save**

### 4. Run the Tunnel

Start the tunnel:

```bash
cloudflared tunnel --config config.yml run
```

To run in the background:

```bash
cloudflared tunnel --config config.yml run &
```

**Note**: The tunnel must be running for your n8n instance to be accessible.
To keep it running permanently, set it up as a system service or use a process
manager like `screen` or `tmux`.

Access n8n at: **<https://YOUR_SUBDOMAIN.YOUR_DOMAIN.com>** (replace with your
actual hostname)

## Reference

For more details, see: <http://jeffbailey.us/blog/2025/11/21/how-do-i-self-host-n8n>
