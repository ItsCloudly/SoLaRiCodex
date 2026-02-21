import requests
from bs4 import BeautifulSoup
import json
import re

def main():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    print("Fetching /live page...")
    r = requests.get('https://streamwest.cc/live', headers=headers)
    soup = BeautifulSoup(r.text, 'html.parser')
    
    event_links = []
    # Find links that look like specific events, usually they have IDs or specific paths
    for a in soup.find_all('a', href=True):
        href = a['href']
        if '/live/' in href or '/stream/' in href or re.search(r'\d+', href):
            if href not in event_links and 'discord' not in href:
                event_links.append(href)
                
    if not event_links:
        print("No apparent event links found on /live. Here are all links:")
        all_links = set([a['href'] for a in soup.find_all('a', href=True)])
        print(json.dumps(list(all_links), indent=2))
        return
        
    print(f"Found event links: {json.dumps(event_links[:5], indent=2)}")
    
    target_event = event_links[0]
    if not target_event.startswith('http'):
        target_event = 'https://streamwest.cc' + target_event
        
    print(f"\nFetching event page: {target_event}")
    e = requests.get(target_event, headers=headers)
    esoup = BeautifulSoup(e.text, 'html.parser')
    
    iframes = esoup.find_all('iframe')
    print(f"Found {len(iframes)} iframes.")
    for iframe in iframes:
        print(f"Iframe src: {iframe.get('src')}")
        
    # Also look for m3u8 directly in scripts
    scripts = esoup.find_all('script')
    for s in scripts:
        if s.string and 'm3u8' in s.string:
            print("Found m3u8 in script:")
            print(s.string[:200])

if __name__ == '__main__':
    main()
