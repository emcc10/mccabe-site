import hashlib, urllib.request, re, pathlib
base='https://www.mccabestheaterandliving.com'
hdr={'Cache-Control':'no-cache','User-Agent':'mc-deploy-probe'}
root=pathlib.Path(r'c:\Users\erink\OneDrive\Documents\GitHub\mccabe-site')

def fetch(url):
    r=urllib.request.Request(url, headers=hdr)
    return urllib.request.urlopen(r, timeout=60).read()

t=fetch(f'{base}/v/template_266.html?v=probe').decode('utf-8','replace')
for label, pat in [
    ('css', r'custom-safe\.css\?v=[^"\']+'),
    ('js', r'mc-pdp-auth-cta-fix\.js\?v=[^"\']+'),
    ('verify', r'MC_TEMPLATE_DEPLOY_VERIFY_[^\s<\-]+'),
    ('inline_ver', r'__MC_PDP_AUTH_CTA_FIX_VER__[^;]{0,80}'),
]:
    m=re.search(pat, t)
    print('TEMPLATE', label, '=>', m.group(0)[:140] if m else 'MISSING')

for path in ['vspfiles/js/mc-pdp-auth-cta-fix.js','vspfiles/css/custom-safe.css','vspfiles/js/mc-unified-pdp-layout.js']:
    live=fetch(f'{base}/v/{path}?v=probe')
    local=(root/path).read_bytes()
    print(path, 'live', len(live), 'local', len(local), 'md5_match', hashlib.md5(live).hexdigest()==hashlib.md5(local).hexdigest())
    if path.endswith('.js'):
        m=re.search(rb'var (?:VERSION|LAYOUT_VER) = "([^"]+)"', live)
        if m: print('  live ver', m.group(1).decode())

# try product URLs
slugs=['bb-faux-fur.htm','sar-dbl-rch-fx-fur.htm','ss-gatlin-pwr-sect.htm']
for slug in slugs:
    for prefix in [f'{base}/{slug}', f'{base}/product-p/{slug}']:
        try:
            html=fetch(prefix+'?cb=1').decode('utf-8','replace')
            if 'product' in html.lower() or 'v-product' in html:
                print('OK', prefix)
                for pat in [r'custom-safe\.css\?v=[^"\']+', r'mc-pdp-auth-cta-fix\.js\?v=[^"\']+', r'20260617pdp6\d']:
                    ms=re.findall(pat, html)
                    if ms: print(' ', pat[:30], set(ms))
                break
        except Exception as e:
            pass
    else:
        print('404 all tries', slug)

# search repo tmp for real URLs
tmp=root/'tmp'
for p in tmp.glob('*bb*faux*.html'):
    html=p.read_text(encoding='utf-8',errors='replace')
    m=re.search(r'<link[^>]+custom-safe\.css\?v=([^"\']+)', html)
    m2=re.search(r'mc-pdp-auth-cta-fix\.js\?v=([^"\']+)', html)
    print('tmp', p.name, 'css', m.group(1) if m else None, 'js', m2.group(1) if m2 else None)
