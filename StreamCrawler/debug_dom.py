"""Debug the page structure to understand section-to-grid relationship."""
import asyncio
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
        page = await ctx.new_page()
        await page.goto('https://streamwest.cc/live', wait_until='domcontentloaded')
        await asyncio.sleep(5)

        # What does the section structure look like?
        structure = await page.evaluate('''() => {
            // Walk the main content area and describe each element with class + tag + text snippet
            const container = document.querySelector('main, #main-content, .content, body');
            const items = [];
            let depth = 0;
            function walk(el) {
                if (el.nodeType !== 1) return;
                const tag = el.tagName;
                const cls = (el.className || '').toString().trim().split(' ').join('.');
                const text = (el.innerText || '').trim().replace(/\\s+/g, ' ').substring(0, 60);
                items.push({ tag, cls, text: text || null });
                if (items.length > 50) return;
                for (const child of el.children) walk(child);
            }
            walk(container);
            return items;
        }''')
        for item in structure[:50]:
            print(item)

        # Also check: does each card have a closest section/parent with sport info?
        card_parent = await page.evaluate('''() => {
            const cards = document.querySelectorAll('.match-card-compact[onclick]');
            return Array.from(cards).slice(0,3).map(card => {
                // Walk up the DOM to find a sport heading
                let el = card;
                while (el) {
                    const prev = el.previousElementSibling;
                    if (prev && (prev.tagName === 'H2' || prev.tagName === 'H3')) {
                        return { card_title: card.innerText.split("\\n")[0], sport_heading: prev.innerText.trim() };
                    }
                    el = el.parentElement;
                }
                return { card_title: card.innerText.split("\\n")[0], sport_heading: null };
            });
        }''')
        print("\n=== Card parent sport heading ===")
        for c in card_parent:
            print(c)

        await browser.close()

asyncio.run(debug())
