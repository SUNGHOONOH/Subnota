import ipaddress
import socket
from urllib.parse import urlparse

import httpx

# Private import: stable across httpcore 1.0.x (pinned). The default sync
# backend is where DNS resolution happens at TCP-connect time.
from httpcore._backends.sync import SyncBackend

ALLOWED_SCHEMES = {"http", "https"}


def _is_blocked_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def ensure_public_http_url(url: str) -> str:
    """Validate that url is an http(s) URL whose host resolves only to public IPs.

    Raises ValueError for unsupported schemes, unresolvable hosts, or any host
    that resolves to a private, loopback, link-local, reserved, or multicast
    address. Used to block SSRF against user-supplied URLs.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES or not parsed.hostname:
        raise ValueError(f"Unsupported or invalid URL: {url}")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        infos = socket.getaddrinfo(parsed.hostname, port)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host: {parsed.hostname}") from exc

    for info in infos:
        ip = info[4][0]
        if _is_blocked_ip(ip):
            raise ValueError(f"Refusing to fetch non-public address: {parsed.hostname} -> {ip}")

    return url


def _validated_public_ip(host: str, port: int) -> str:
    """Resolve host and return one public IP literal, or raise.

    Resolving here — at TCP-connect time inside the transport — and connecting
    to the returned IP closes the DNS-rebinding/TOCTOU gap that a
    resolve-then-connect-by-hostname flow leaves open: the check-time and
    use-time resolutions become the same one.
    """
    try:
        infos = socket.getaddrinfo(host, port)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host: {host}") from exc
    if not infos:
        raise ValueError(f"Could not resolve host: {host}")
    for info in infos:
        ip = info[4][0]
        if _is_blocked_ip(ip):
            raise ValueError(f"Refusing to connect to non-public address: {host} -> {ip}")
    return infos[0][4][0]


def resolve_public_ip_literal(url: str) -> tuple[str, int, str]:
    """Resolve an http(s) URL's host to a single validated public IP.

    Returns (host, port, ip). Raises ValueError for unsupported schemes or any
    host that resolves to a non-public address. The Playwright fallback uses the
    returned IP to pin the browser's DNS (via --host-resolver-rules) so the
    checked resolution and the connected resolution are the same one, closing the
    DNS-rebinding gap that hostname-based navigation otherwise leaves open. This
    mirrors what SsrfSafeTransport does for the httpx path.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES or not parsed.hostname:
        raise ValueError(f"Unsupported or invalid URL: {url}")

    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    ip = _validated_public_ip(parsed.hostname, port)
    return parsed.hostname, port, ip


class _PinnedSyncBackend(SyncBackend):
    """Network backend that validates + pins the resolved IP at connect time."""

    def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
        ip = _validated_public_ip(host, port)
        return super().connect_tcp(
            ip,
            port,
            timeout=timeout,
            local_address=local_address,
            socket_options=socket_options,
        )


class SsrfSafeTransport(httpx.HTTPTransport):
    """httpx transport that pins each connection to a validated public IP.

    TLS SNI / certificate verification is unaffected: httpcore passes the
    original hostname to start_tls via server_hostname, independent of the IP
    used for the TCP connection.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._pool._network_backend = _PinnedSyncBackend()


def build_ssrf_safe_client(**kwargs) -> httpx.Client:
    """An httpx.Client whose connections are IP-validated against SSRF."""
    return httpx.Client(transport=SsrfSafeTransport(), **kwargs)
