#!/bin/bash
# VPN gateway: build the sing-box config from the subscription, install an
# iptables transparent-redirect for outbound TCP, then run sing-box. cloudflared
# shares this container's network namespace (network_mode: service:vpngw), so its
# traffic to the Cloudflare edge is transparently sent through the VLESS tunnel —
# defeating the provider's SNI-based DPI that blocks a plain Cloudflare Tunnel.
set -euo pipefail

echo "[vpngw] generating sing-box config from subscription..."
python3 /gen-config.py

REDIR_PORT=12345
MARK=255

echo "[vpngw] installing iptables transparent redirect..."
# Manage ONLY our own chain. Never `iptables -t nat -F`: that flushes Docker's
# embedded-DNS NAT (127.0.0.11 -> DOCKER_OUTPUT) and breaks name resolution, so
# cloudflared can't resolve caddy (origin 502).
iptables -t nat -N SBOX 2>/dev/null || iptables -t nat -F SBOX

# Never redirect traffic bound for local / private / internal Docker networks:
# that's how cloudflared reaches caddy:80 and how DNS to 127.0.0.11 works.
for net in 0.0.0.0/8 10.0.0.0/8 127.0.0.0/8 169.254.0.0/16 \
           172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 \
           224.0.0.0/4 240.0.0.0/4; do
  iptables -t nat -A SBOX -d "$net" -j RETURN
done

# Everything else (public destinations, i.e. the CF edge) goes to sing-box.
iptables -t nat -A SBOX -p tcp -j REDIRECT --to-ports "$REDIR_PORT"

# Hook OUTPUT idempotently (appended after Docker's own rules, so the DNS rule
# for 127.0.0.11 still runs first). sing-box's own upstream packets are marked;
# let them out untouched to avoid a redirect loop.
iptables -t nat -C OUTPUT -p tcp -m mark --mark "$MARK" -j RETURN 2>/dev/null \
  || iptables -t nat -A OUTPUT -p tcp -m mark --mark "$MARK" -j RETURN
iptables -t nat -C OUTPUT -p tcp -j SBOX 2>/dev/null \
  || iptables -t nat -A OUTPUT -p tcp -j SBOX

echo "[vpngw] starting sing-box..."
exec sing-box run -c /etc/sing-box/config.json
