"""
StreamWest Live Sports Scraper
==============================
Scrapes live stream URLs (and rich metadata) from https://streamwest.cc

How it works:
1. Uses Playwright (headless browser) to load the /live page and extract ALL
   metadata from event cards in a single pass:
   - sport        – e.g. "Football", "Basketball" (from the <h2> section heading)
   - title        – e.g. "Piast Gliwice vs Motor Lublin"
   - teams        – [team_a, team_b] parsed from the title (split on " vs ")
   - thumbnail    – poster image URL for the event
   - viewer_count – current viewer count (int)
   - is_live      – True if the event is currently live
   - streamwest_url – direct link to the StreamWest event page
2. For each event, loads the event page to find the embedded player iframe URL.
3. Calls the embedsporty.top /fetch API (pure HTTP, no browser) to get the
   security token (goat header) and load-balancer hostname.
4. Constructs the final m3u8 HLS stream URL.

Output: streams.json – ready to consume by the app. Fields per event:
  title, sport, teams, thumbnail, viewer_count, is_live,
  streamwest_url, embed_url, stream, error
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import asyncio
import json
import re
import requests
from playwright.async_api import async_playwright

BASE_URL = 'https://streamwest.cc'
EMBED_API = 'https://embedsporty.top/fetch'


# ─────────────────────────────────────────────────────────────────────────────
# Token / m3u8 extraction (pure HTTP)
# ─────────────────────────────────────────────────────────────────────────────

def _encode_proto_string(field_num: int, value: str) -> bytes:
    """Encode a string as a protobuf length-delimited field."""
    encoded = value.encode('utf-8')
    tag = (field_num << 3) | 2  # wire type 2
    return bytes([tag, len(encoded)]) + encoded


def build_fetch_body(server: str, slug: str, stream_num: str) -> bytes:
    """Build the protobuf request body for the /fetch endpoint."""
    return (
        _encode_proto_string(1, server)
        + _encode_proto_string(2, slug)
        + _encode_proto_string(3, stream_num)
    )


def parse_embed_url(embed_url: str) -> tuple[str, str, str] | None:
    """
    Extract (server, slug, stream_num) from an embed URL like:
        https://embedsporty.top/embed/echo/some-match-slug-12345/1
    """
    m = re.match(r'https?://[^/]+/embed/([^/]+)/(.+)/(\d+)$', embed_url)
    if not m:
        return None
    return m.group(1), m.group(2), m.group(3)


def get_stream_url(embed_url: str) -> dict:
    """
    Call the embedsporty.top /fetch endpoint and return the m3u8 URL.
    Returns a dict: { 'goat': ..., 'lb': ..., 'm3u8': ... } or empty dict on failure.
    """
    parsed = parse_embed_url(embed_url)
    if not parsed:
        return {}

    server, slug, stream_num = parsed
    body = build_fetch_body(server, slug, stream_num)

    headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        ),
        'Content-Type': 'application/octet-stream',
        'Referer': embed_url,
        'Origin': 'https://embedsporty.top',
    }

    try:
        resp = requests.post(EMBED_API, data=body, headers=headers, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        return {'error': str(e)}

    goat_token = resp.headers.get('goat')
    if not goat_token:
        return {'error': 'No goat header in response'}

    # The binary response body contains the lb server hostname (e.g. "lb10")
    body_str = resp.content.decode('utf-8', errors='replace')
    lb_match = re.search(r'lb\d+', body_str)
    lb_server = lb_match.group(0) if lb_match else 'lb2'  # fallback

    m3u8 = (
        f"https://{lb_server}.strmd.top/secure/{goat_token}"
        f"/{server}/stream/{slug}/{stream_num}/playlist.m3u8"
    )
    return {'goat': goat_token, 'lb': lb_server, 'm3u8': m3u8}


# ─────────────────────────────────────────────────────────────────────────────
# Playwright helpers
# ─────────────────────────────────────────────────────────────────────────────

async def close_popup(popup):
    await popup.close()


async def get_live_events(context) -> list[dict]:
    """
    Load the /live page and extract ALL metadata from event cards in one pass.
    Returns a list of event dicts with: title, sport, teams, thumbnail,
    viewer_count, is_live, href.
    """
    page = await context.new_page()
    page.on("popup", close_popup)

    await page.goto(f'{BASE_URL}/live', wait_until='domcontentloaded')
    await asyncio.sleep(5)

    events = await page.evaluate('''() => {
        const results = [];
        const processed = new Set();
        
        // Helper to extract a single card
        function extractCard(card, sport) {
            const onclick = card.getAttribute('onclick') || '';
            const hrefMatch = onclick.match(/location\\.href='([^']+)'/);
            const href = hrefMatch ? hrefMatch[1] : null;
            if (!href || processed.has(href)) return null;
            processed.add(href);

            // Title
            const titleEl = card.querySelector(
                '.match-title-compact, [class*="title"], [class*="match-name"], h3, h4'
            );
            const title = titleEl
                ? titleEl.innerText.trim()
                : card.innerText.split("\\n").filter(Boolean)[0] || 'Unknown';

            // Teams: split on " vs " (case-insensitive)
            const parts = title.split(/ vs /i);
            const teams = parts.length >= 2
                ? [parts[0].trim(), parts.slice(1).join(' vs ').trim()]
                : [];

            // Poster / thumbnail image
            const img = card.querySelector('img.match-poster-img, img[class*="poster"], img');
            const thumbnail = img ? (img.src || img.dataset.src || null) : null;

            // Live indicator
            const liveEl = card.querySelector(
                '.live-indicator, [class*="live"], .badge-live'
            );
            const is_live = liveEl
                ? liveEl.innerText.toLowerCase().includes('live')
                : false;

            // Optional sport override from badge inside card
            const sportEl = card.querySelector(
                '[class*="sport-badge"], [class*="sport-tag"], [class*="category"]'
            );
            const sport_override = sportEl ? sportEl.innerText.trim() : null;

            // Viewer count (looking for icon + number)
            const allSpans = Array.from(card.querySelectorAll('span'));
            let viewer_count = 0;
            for (const s of allSpans) {
                const m = s.innerText.match(/(\\d+)/);
                if (m && (s.innerText.includes('👁️') || s.innerText.includes('👀'))) {
                    viewer_count = parseInt(m[1]);
                    break;
                }
            }

            return {
                href,
                title,
                sport: sport_override || sport || 'Other',
                teams,
                thumbnail,
                is_live,
                viewer_count,
            };
        }

        const cards = document.querySelectorAll('.match-card-compact[onclick]');
        for (const card of cards) {
            // Find parent grid or section container
            let el = card;
            let sportHeading = 'Other';
            while (el && el.tagName !== 'BODY') {
                // If we found the grid, look at its previous sibling for h2
                if (el.classList && (el.classList.contains('matches-grid-compact') || el.className.includes('grid'))) {
                    let prev = el.previousElementSibling;
                    while (prev) {
                        if (prev.tagName === 'H2' || prev.tagName === 'H3') {
                            sportHeading = prev.innerText.trim();
                            break;
                        }
                        prev = prev.previousElementSibling;
                    }
                    if (sportHeading !== 'Other') break;
                }
                el = el.parentElement;
            }
            const data = extractCard(card, sportHeading);
            if (data) results.push(data);
        }

        return results;
    }''')

    await page.close()
    return events


async def get_embed_url(context, event_href: str) -> str | None:
    """Navigate to an event page and extract the video player iframe embed src."""
    full_url = BASE_URL + event_href if event_href.startswith('/') else event_href
    page = await context.new_page()
    page.on("popup", close_popup)

    try:
        await page.goto(full_url, wait_until='domcontentloaded')
        await asyncio.sleep(3)

        embed_url = await page.evaluate('''() => {
            for (const f of document.querySelectorAll('iframe')) {
                if (f.src && (f.src.includes('embed') || f.src.includes('stream'))) {
                    return f.src;
                }
            }
            return null;
        }''')
        return embed_url
    except Exception as e:
        print(f"  [Error] getting embed for {full_url}: {e}")
        return None
    finally:
        await page.close()


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

async def scrape_all_events(headless: bool = True) -> list[dict]:
    results = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent=(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            )
        )

        print("Fetching live event list ...")
        events = await get_live_events(context)
        print(f"Found {len(events)} events.")

        for event in events:
            title = event['title']
            href = event['href']
            streamwest_url = BASE_URL + href if href.startswith('/') else href
            print(f"\n[{event.get('sport', '?')}] {title}")

            embed_url = await get_embed_url(context, href)
            if not embed_url:
                print("  [FAIL] No embed iframe found")
                results.append({
                    **event,
                    'streamwest_url': streamwest_url,
                    'embed_url': None,
                    'stream': None,
                    'error': 'No embed found',
                })
                continue

            stream_data = get_stream_url(embed_url)
            m3u8 = stream_data.get('m3u8')
            if m3u8:
                print(f"  [OK] Stream ready")
            else:
                print(f"  [FAIL] Failed: {stream_data.get('error', 'unknown error')}")

            results.append({
                **event,                        # title, sport, teams, thumbnail, is_live, viewer_count
                'streamwest_url': streamwest_url,
                'embed_url': embed_url,
                'stream': m3u8,
                'error': stream_data.get('error'),
            })

        await browser.close()

    return results


if __name__ == '__main__':
    events = asyncio.run(scrape_all_events(headless=True))

    # Group by sport for clean output
    from collections import defaultdict
    by_sport = defaultdict(list)
    for e in events:
        by_sport[e.get('sport', 'Other')].append(e)

    print("\n\n=== RESULTS ===")
    for sport, sport_events in by_sport.items():
        print(f"\n  [{sport}]")
        for e in sport_events:
            status = "[OK]" if e['stream'] else "[FAIL]"
            teams_str = ' vs '.join(e.get('teams') or [e['title']])
            viewers = e.get('viewer_count', 0)
            live_tag = 'LIVE' if e.get('is_live') else 'Upcoming'
            print(f"    {status} {live_tag}  {teams_str}  ({viewers} viewers)")

    success = sum(1 for e in events if e['stream'])
    print(f"\n{success}/{len(events)} streams found.")

    with open('streams.json', 'w', encoding='utf-8') as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
    print("Saved to streams.json")
