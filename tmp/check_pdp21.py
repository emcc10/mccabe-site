import re, time, urllib.request
cb=str(int(time.time()))
for url,label in [
 ('https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-pdp-auth-cta-fix.js?cb='+cb,'js'),
 ('https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-plp-enforcer.js?cb='+cb,'enf'),
 ('https://www.mccabestheaterandliving.com/template_266.html?cb='+cb,'tpl')
]:
    req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    txt=urllib.request.urlopen(req, timeout=30).read().decode('utf-8','ignore')
    print(label, 'pdp21' in txt)
    m=re.search(r'20260616pdp\d+', txt)
    if m: print(label, m.group(0))
