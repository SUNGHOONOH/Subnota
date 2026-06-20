import ipaddress
import socket
from urllib.parse import urlparse

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
