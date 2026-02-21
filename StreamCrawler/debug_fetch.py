"""
Inspect the /fetch endpoint response from embedsporty.top in detail.
Save the binary body to a file for analysis.
"""
import asyncio
import json
from playwright.async_api import async_playwright

EMBED_URL = 'https://embedsporty.top/embed/echo/piast-gliwice-vs-motor-lublin-football-1380579/1'

async def inspect_fetch():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        fetch_data = {}

        async def on_response(response):
            url = response.url
            if '/fetch' in url:
                try:
                    body = await response.body()
                    fetch_data['url'] = url
                    fetch_data['status'] = response.status
                    fetch_data['response_headers'] = dict(response.headers)
                    fetch_data['body_len'] = len(body)
                    fetch_data['body_utf8'] = body.decode('utf-8', errors='replace')
                    fetch_data['body_hex'] = body.hex()
                    # Save raw bytes
                    with open('fetch_response.bin', 'wb') as f:
                        f.write(body)
                except Exception as e:
                    fetch_data['error'] = str(e)
            elif '.m3u8' in url and fetch_data.get('m3u8') is None:
                fetch_data['m3u8'] = url

        page.on("response", on_response)

        # Also intercept the request to see what data is sent
        async def on_request(request):
            if '/fetch' in request.url:
                try:
                    post_data = request.post_data
                    fetch_data['request_post_data'] = post_data
                    fetch_data['request_headers'] = dict(request.headers)
                    fetch_data['request_method'] = request.method
                except Exception as e:
                    fetch_data['request_error'] = str(e)

        page.on("request", on_request)

        await page.goto(EMBED_URL, wait_until='domcontentloaded')
        await asyncio.sleep(8)

        # Check JW Player
        jw_file = await page.evaluate('''() => {
            try { return jwplayer().getConfig().playlist[0].file; } catch(e) { return null; }
        }''')
        fetch_data['jw_file'] = jw_file

        await browser.close()

    # Write results to JSON for easy inspection
    with open('fetch_debug.json', 'w', encoding='utf-8') as f:
        json.dump(fetch_data, f, indent=2, ensure_ascii=False)

    print("=== FETCH DEBUG ===")
    print(f"Request method: {fetch_data.get('request_method')}")
    print(f"Request POST data: {repr(fetch_data.get('request_post_data'))}")
    print(f"Request headers (relevant): content-type={fetch_data.get('request_headers', {}).get('content-type')}")
    print(f"\nResponse status: {fetch_data.get('status')}")
    print(f"Response headers: {json.dumps(fetch_data.get('response_headers', {}), indent=2)}")
    print(f"Response body length: {fetch_data.get('body_len')} bytes")
    print(f"Response body (utf8): {repr(fetch_data.get('body_utf8', '')[:500])}")
    print(f"\nM3u8 URL (from network): {fetch_data.get('m3u8')}")
    print(f"JW Player file: {fetch_data.get('jw_file')}")
    print("\nFull debug saved to fetch_debug.json")

if __name__ == '__main__':
    asyncio.run(inspect_fetch())
