# VPN gateway image: sing-box (VLESS/Reality) + iptables transparent redirect.
# cloudflared shares this container's netns so its edge traffic tunnels through
# the VLESS proxy, bypassing the provider's SNI DPI on Cloudflare.
FROM alpine:3.20

RUN apk add --no-cache curl ca-certificates iptables ip6tables python3 bash tar

# Pin sing-box to a known-good release (Reality/Vision + gRPC supported).
ARG SINGBOX_VERSION=1.10.7
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64) sbarch=amd64 ;; \
      aarch64) sbarch=arm64 ;; \
      *) echo "unsupported arch $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/SagerNet/sing-box/releases/download/v${SINGBOX_VERSION}/sing-box-${SINGBOX_VERSION}-linux-${sbarch}.tar.gz" -o /tmp/sb.tgz; \
    tar -xzf /tmp/sb.tgz -C /tmp; \
    mv "/tmp/sing-box-${SINGBOX_VERSION}-linux-${sbarch}/sing-box" /usr/local/bin/sing-box; \
    chmod +x /usr/local/bin/sing-box; \
    rm -rf /tmp/*; \
    sing-box version

COPY gen-config.py /gen-config.py
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh /gen-config.py

ENTRYPOINT ["/entrypoint.sh"]
