import re
import urllib.request

for slug in ["bb-corduroy.htm", "bb-microsuede.htm", "bb-nest-closeout.htm", "bb-faux-fur.htm", "bb-nest.htm"]:
    url = f"https://www.mccabestheaterandliving.com/product-p/{slug}"
    try:
        html = urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30
        ).read().decode("utf-8", "replace")
        ot = 'id="options_table"' in html
        sels = re.findall(r'<select[^>]+name="([^"]+)"', html, re.I)
        print(slug, "options_table", ot, "selects", sels[:8])
        if sels:
            for m in re.finditer(r'<select[^>]+name="([^"]+)"[^>]*>(.*?)</select>', html, re.I | re.S):
                if "___" in m.group(1):
                    opts = re.findall(r'<option[^>]+value="([^"]*)"[^>]*>([^<]*)', m.group(2), re.I)
                    print(" ", m.group(1), opts[:6])
    except Exception as e:
        print(slug, e)
