"""
Test directly calling the embedsporty.top /fetch endpoint via requests
to extract the goat token and lb server from the response.
"""
import re
import requests

EMBED_BASE = 'https://embedsporty.top'

def build_fetch_body(server: str, slug: str, stream_num: str) -> bytes:
    """
    Build a minimal protobuf message:
      Field 1 (string): server
      Field 2 (string): slug
      Field 3 (string): stream_num
    """
    def encode_string_field(field_num: int, value: str) -> bytes:
        encoded = value.encode('utf-8')
        tag = (field_num << 3) | 2  # wire type 2 = length-delimited
        return bytes([tag, len(encoded)]) + encoded

    body = b''
    body += encode_string_field(1, server)
    body += encode_string_field(2, slug)
    body += encode_string_field(3, stream_num)
    return body


def parse_embed_url(embed_url: str) -> tuple[str, str, str]:
    """
    Parse: https://embedsporty.top/embed/{server}/{slug}/{num}
    Returns (server, slug, num)
    """
    m = re.match(r'https?://[^/]+/embed/([^/]+)/(.+)/(\d+)$', embed_url)
    if not m:
        raise ValueError(f"Cannot parse embed URL: {embed_url}")
    return m.group(1), m.group(2), m.group(3)


def fetch_stream_url(embed_url: str) -> dict:
    server, slug, num = parse_embed_url(embed_url)
    body = build_fetch_body(server, slug, num)

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Content-Type': 'application/octet-stream',
        'Referer': embed_url,
        'Origin': EMBED_BASE,
    }

    resp = requests.post(f'{EMBED_BASE}/fetch', data=body, headers=headers, timeout=10)
    print(f"  Status: {resp.status_code}")
    print(f"  Headers: {dict(resp.headers)}")

    goat_token = resp.headers.get('goat')
    
    # The binary response likely encodes the load balancer info
    # Let's look for 'lb' pattern in the body
    body_str = resp.content.decode('utf-8', errors='replace')
    lb_match = re.search(r'lb\d+', body_str)
    lb_server = lb_match.group(0) if lb_match else 'lb2'
    
    # Also check for any hostname pattern in the raw bytes
    raw_hex = resp.content.hex()
    print(f"  Body hex: {raw_hex[:100]}")
    print(f"  Body utf8 (first 100): {repr(body_str[:100])}")
    print(f"  Body length: {len(resp.content)} bytes")
    print(f"  goat token: {goat_token}")
    print(f"  lb server found: {lb_server}")

    if goat_token:
        m3u8 = f"https://{lb_server}.strmd.top/secure/{goat_token}/{server}/stream/{slug}/{num}/playlist.m3u8"
        return {
            'embed_url': embed_url,
            'goat_token': goat_token,
            'lb_server': lb_server,
            'm3u8': m3u8,
        }
    return {}


if __name__ == '__main__':
    test_url = 'https://embedsporty.top/embed/echo/piast-gliwice-vs-motor-lublin-football-1380579/1'
    print(f"Testing: {test_url}")
    result = fetch_stream_url(test_url)
    print(f"\nResult: {result}")
