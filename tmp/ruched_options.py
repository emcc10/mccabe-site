import re, urllib.request
url='https://www.mccabestheaterandliving.com/product-p/sar-dbl-rch-fx-fur.htm'
html=urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=30).read().decode('utf-8','replace')
for m in re.finditer(r'<option[^>]*value="(\d+)"[^>]*>([^<]*)</option>', html):
    v,t=m.group(1),m.group(2).strip()
    if v and t: print(v, t)
