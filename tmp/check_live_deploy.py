import urllib.request, time

UA = {"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"}

def head_of(url, marker):
    req = urllib.request.Request(url + "?mcv=" + str(int(time.time())), headers=UA)
    body = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    print(url.split("/")[-1], "->", "FOUND" if marker in body else "missing", f"({marker})")

head_of("https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-plp-enforcer.js", "20260627a")
head_of("https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-pdp-auth-cta-fix.js", "20260612price")
head_of("https://www.mccabestheaterandliving.com/v/vspfiles/css/mc-plp-body-last.css", "image fills the wrapper box")
head_of("https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css", "PDP PRICE: 18px")
