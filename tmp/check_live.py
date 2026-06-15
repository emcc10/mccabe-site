import re, time, urllib.request

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")

cb = str(int(time.time()))
js = fetch("https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-pdp-auth-cta-fix.js?cb=" + cb)
m = re.search(r'var VERSION = "([^"]+)"', js)
print("live JS VERSION:", m.group(1) if m else "NOT FOUND")

css = fetch("https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css?cb=" + cb)
print("css has pdp17 block:", "MC PDP LOCK pdp17" in css)
print("css has price-atc-row:", "#mc-pdp-price-atc-row" in css)
