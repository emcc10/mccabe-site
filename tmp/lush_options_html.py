import re, urllib.request
url='https://www.mccabestheaterandliving.com/product-p/sar-lush-mini.htm'
html=urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=30).read().decode('utf-8','replace')
# options table chunk
m=re.search(r'id="options_table".{0,4000}', html, re.S|re.I)
print(m.group(0)[:3500] if m else 'no table')
# any option image urls in page
for pat in [r'option[^>]*image[^>]*', r'OptionImage', r'optionphoto', r'1069[^"\']{0,60}']:
    for x in re.finditer(pat, html, re.I):
        print(x.group(0)[:100])
