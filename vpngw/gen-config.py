#!/usr/bin/env python3
"""Build a sing-box config from a VLESS subscription URL.

Downloads $VPN_SUB_URL (a base64 list of vless:// URIs), turns each server into a
sing-box VLESS outbound (Reality/Vision + gRPC supported; xHTTP skipped), wraps
them in a url-test selector that auto-picks the fastest live server, and writes
/etc/sing-box/config.json. A `redirect` inbound receives the iptables-redirected
traffic (see entrypoint.sh); every outbound carries routing_mark=255 so its own
packets to the VPN server are excluded from the redirect (no loop).
"""
import base64
import json
import os
import re
import sys
import urllib.parse
import urllib.request

MARK = 255
REDIR_PORT = 12345
SUB_URL = os.environ.get("VPN_SUB_URL", "").strip()

if not SUB_URL:
    print("VPN_SUB_URL is empty", file=sys.stderr)
    sys.exit(1)


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "sing-box"})
    with urllib.request.urlopen(req, timeout=20) as r:
        raw = r.read().decode("utf-8", "ignore").strip()
    # Subscriptions are usually base64; fall back to raw if it isn't.
    pad = raw + "=" * (-len(raw) % 4)
    try:
        dec = base64.b64decode(pad).decode("utf-8", "ignore")
        if "://" in dec:
            return dec
    except Exception:
        pass
    return raw


def parse_vless(uri: str):
    m = re.match(r"vless://([^@]+)@([^:]+):(\d+)\?([^#]*)(?:#(.*))?", uri)
    if not m:
        return None
    uuid, host, port, query, name = m.groups()
    p = dict(urllib.parse.parse_qsl(query))
    return {
        "name": urllib.parse.unquote(name or host),
        "uuid": uuid,
        "server": host,
        "port": int(port),
        "type": p.get("type", "tcp"),          # tcp / grpc / xhttp / ws
        "security": p.get("security", "none"),  # reality / tls / none
        "sni": p.get("sni", ""),
        "flow": p.get("flow", ""),
        "pbk": p.get("pbk", ""),
        "sid": p.get("sid", ""),
        "fp": p.get("fp", "") or "chrome",
        "path": p.get("path", ""),
        "servicename": p.get("serviceName", "") or p.get("servicename", ""),
    }


def to_outbound(s, tag):
    ob = {
        "type": "vless",
        "tag": tag,
        "server": s["server"],
        "server_port": s["port"],
        "uuid": s["uuid"],
        "routing_mark": MARK,
        "domain_strategy": "prefer_ipv4",
    }
    transport = s["type"]
    if transport == "grpc":
        ob["transport"] = {"type": "grpc", "service_name": s["servicename"]}
    elif transport in ("ws",):
        ob["transport"] = {"type": "ws", "path": s["path"] or "/"}
    # Vision flow is only valid on raw tcp.
    if s["flow"] and transport == "tcp":
        ob["flow"] = s["flow"]
    if s["security"] in ("reality", "tls"):
        tls = {
            "enabled": True,
            "server_name": s["sni"] or s["server"],
            "utls": {"enabled": True, "fingerprint": s["fp"]},
        }
        if s["security"] == "reality":
            tls["reality"] = {
                "enabled": True,
                "public_key": s["pbk"],
                "short_id": s["sid"],
            }
        ob["tls"] = tls
    return ob


def main():
    text = fetch(SUB_URL)
    servers = []
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("vless://"):
            continue
        s = parse_vless(line)
        if not s:
            continue
        # xHTTP transport support is version-sensitive; skip to stay robust.
        if s["type"] == "xhttp":
            continue
        servers.append(s)

    if not servers:
        print("no usable vless servers parsed from subscription", file=sys.stderr)
        sys.exit(1)

    outbounds = []
    tags = []
    for i, s in enumerate(servers):
        tag = f"s{i}"
        outbounds.append(to_outbound(s, tag))
        tags.append(tag)

    outbounds.append({
        "type": "urltest",
        "tag": "auto",
        "outbounds": tags,
        "url": "https://www.gstatic.com/generate_204",
        "interval": "3m0s",
        "tolerance": 100,
    })
    outbounds.append({"type": "direct", "tag": "direct", "routing_mark": MARK})

    config = {
        "log": {"level": "warn"},
        "inbounds": [
            {
                "type": "redirect",
                "tag": "redir",
                "listen": "::",
                "listen_port": REDIR_PORT,
            }
        ],
        "outbounds": outbounds,
        "route": {
            "rules": [
                # sing-box's own DNS/marked traffic stays direct.
                {"ip_is_private": True, "outbound": "direct"},
            ],
            "final": "auto",
            "auto_detect_interface": False,
        },
    }

    os.makedirs("/etc/sing-box", exist_ok=True)
    with open("/etc/sing-box/config.json", "w") as f:
        json.dump(config, f, indent=2)
    print(f"sing-box config written: {len(servers)} servers, url-test auto-select")


if __name__ == "__main__":
    main()
