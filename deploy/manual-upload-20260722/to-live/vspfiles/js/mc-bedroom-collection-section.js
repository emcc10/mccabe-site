/* MC_BEDROOM_COLLECTION_SECTION_20260723mob1 */
!function(w,d){
  'use strict';

  if(!w||!d||w.__MC_BEDROOM_COLLECTION_SECTION_20260723mob1__)return;
  w.__MC_BEDROOM_COLLECTION_SECTION_20260723mob1__=!0;
  w.__MC_BEDROOM_COLLECTION_SECTION_20260620__=!0;

  var PIECE_RE=/\b(chest|dresser|king bed|queen bed|bed|nightstand|night stand|mirror|armoire|wardrobe|media chest|gentlemans chest|gentleman's chest|drawer chest|door chest|bachelor chest|california king bed|cal king bed|twin bed|full bed)\b/i;
  var STYLE_ID='mc-bedroom-collection-css';
  var SECTION_ID='mc-bedroom-collection';
  var STATIC_PRODUCTS=[
    {c:'SS-BC900CTT',n:'Bear Creek Chest',co:'Bear Creek'},
    {c:'SS-BC950CTBT',n:'Bear Creek Chest',co:'Bear Creek'},
    {c:'SS-BC900DR',n:'Bear Creek Dresser',co:'Bear Creek'},
    {c:'SS-BC950DRB',n:'Bear Creek Dresser',co:'Bear Creek'},
    {c:'SS-BC950KFB',n:'Bear Creek King Bed, Brown',co:'Bear Creek'},
    {c:'SS-BC900MR',n:'Bear Creek Mirror',co:'Bear Creek'},
    {c:'SS-BC950MRB',n:'Bear Creek Mirror',co:'Bear Creek'},
    {c:'SS-BC900NS',n:'Bear Creek Nightstand',co:'Bear Creek'},
    {c:'SS-BC950NSB',n:'Bear Creek Nightstand',co:'Bear Creek'},
    {c:'SS-BC950QFB',n:'Bear Creek Queen Bed, Brown',co:'Bear Creek'},
    {c:'SS-CAS900C',n:'Cassie Illuminating Chest',co:'Cassie Illuminating'},
    {c:'SS-CAS900DR',n:'Cassie Illuminating Dresser',co:'Cassie Illuminating'},
    {c:'SS-CAS900KFB',n:'Cassie Illuminating King Bed, Shimmering Pearl Finish',co:'Cassie Illuminating'},
    {c:'SS-CAS900M',n:'Cassie Illuminating Mirror',co:'Cassie Illuminating'},
    {c:'SS-CAS900NS',n:'Cassie Illuminating Nightstand',co:'Cassie Illuminating'},
    {c:'SS-CAS900QFB',n:'Cassie Illuminating Queen Bed, Shimmering Pearl Finish',co:'Cassie Illuminating'},
    {c:'SS-HP900CTWT',n:'Highland Park Chest, Cathedral White',co:'Highland Park'},
    {c:'SS-HP900CTDT',n:'Highland Park Chest, Waxed Driftwood',co:'Highland Park'},
    {c:'SS-HP900KFBW',n:'Highland Park King Bed, Cathedral White',co:'Highland Park'},
    {c:'SS-HP900KFBD',n:'Highland Park King Bed, Waxed Driftwood',co:'Highland Park'},
    {c:'SS-HP900MRW',n:'Highland Park Mirror, Cathedral White',co:'Highland Park'},
    {c:'SS-HP900MRD',n:'Highland Park Mirror, Waxed Driftwood',co:'Highland Park'},
    {c:'SS-HP900NSW',n:'Highland Park Nightstand, Cathedral White',co:'Highland Park'},
    {c:'SS-HP900NSD',n:'Highland Park Nightstand, Waxed Driftwood',co:'Highland Park'},
    {c:'SS-HP900QFBW',n:'Highland Park Queen Bed, Cathedral White',co:'Highland Park'},
    {c:'SS-HP900QFBD',n:'Highland Park Queen Bed, Waxed Driftwood',co:'Highland Park'}
  ];

  function q(sel,root){return(root||d).querySelector(sel)}
  function qa(sel,root){return Array.prototype.slice.call((root||d).querySelectorAll(sel))}
  function text(el){return(el&&String(el.textContent||el.getAttribute&&el.getAttribute('content')||'').replace(/\s+/g,' ').trim())||''}
  function abs(url){
    if(!url)return'';
    try{return new URL(url,w.location.href).href}catch(_){return url}
  }
  function cleanName(value){
    return String(value||'')
      .replace(/\s+-\s+McCabe.*$/i,'')
      .replace(/\s+\|\s+McCabe.*$/i,'')
      .replace(/\s+/g,' ')
      .trim();
  }
  function currentName(){
    var candidates=[
      q('h1[itemprop="name"]'),
      q('.productnamecolorLARGE'),
      q('#productname'),
      q('.productnamecolor'),
      q('h1'),
      q('meta[property="og:title"]'),
      q('meta[name="twitter:title"]'),
      q('[itemprop="name"]')
    ];
    for(var i=0;i<candidates.length;i++){
      var name=cleanName(text(candidates[i])||(candidates[i]&&candidates[i].content));
      if(name&&name.length>2)return name;
    }
    return cleanName(d.title);
  }
  function collectionFromName(name){
    name=cleanName(name);
    if(!PIECE_RE.test(name))return'';

    var match=name.match(new RegExp('^(.*?)\\s+'+PIECE_RE.source+'(?:[\\s,\\-]|$)','i'));
    if(match&&match[1])return cleanName(match[1]);

    var words=name.split(/\s+/);
    if(/^the$/i.test(words[0])&&words.length>2)return words.slice(0,2).join(' ');
    if(words.length>2)return words.slice(0,2).join(' ');
    if(words.length>1)return words.join(' ');
    return'';
  }
  function currentProductCode(){
    return String(
      w.global_Current_ProductCode||
      (q('input[name="ProductCode"]')&&q('input[name="ProductCode"]').value)||
      ''
    ).toUpperCase();
  }
  function productUrlMatchesCurrent(href){
    var h=String(href||'').toLowerCase();
    var code=currentProductCode().toLowerCase();
    return!!(
      h&&
      (h.replace(/\/$/,'')===String(w.location.href).toLowerCase().replace(/\/$/,'')||
       (code&&h.indexOf('/product-p/'+code.toLowerCase())!==-1)||
       (code&&h.indexOf(code.toLowerCase())!==-1))
    );
  }
  function codeFromHref(href){
    var m=String(href||'').match(/product-p\/([^\/?#.]+)/i);
    if(!m||!m[1])return'';
    var slug=String(m[1]).toUpperCase();
    if(/^SS-/.test(slug)||/^SAR-/.test(slug)||/^[A-Z0-9]+-[A-Z0-9-]+$/.test(slug))return slug;
    for(var i=0;i<STATIC_PRODUCTS.length;i++){
      if(STATIC_PRODUCTS[i].c.toUpperCase()===slug)return STATIC_PRODUCTS[i].c;
    }
    return'';
  }
  function imageFromCode(code){
    if(!code)return'';
    return'/v/vspfiles/photos/'+code+'-1.jpg';
  }
  function imageFromStaticName(name){
    var n=cleanName(name).toLowerCase();
    for(var i=0;i<STATIC_PRODUCTS.length;i++){
      if(STATIC_PRODUCTS[i].n.toLowerCase()===n)return imageFromCode(STATIC_PRODUCTS[i].c);
    }
    return'';
  }
  function findName(anchor,card){
    return cleanName(
      text(q('.productnamecolor, .productnamecolorLARGE, .v-product__name, [itemprop="name"], .productname',card))||
      text(anchor)||
      (anchor&&anchor.getAttribute('title'))||
      ''
    );
  }
  function findPrice(card){
    return text(q('.productprice, .price, [itemprop="price"], .saleprice, .ourprice',card));
  }
  function findImage(anchor,card){
    var img=q('img',anchor)||q('img',card);
    var src=img?abs(img.getAttribute('data-src')||img.getAttribute('data-original')||img.getAttribute('src')):'';
    if(src&&!/clear1x1|spacer|blank|nophoto/i.test(src))return src;
    var code=codeFromHref(anchor&&anchor.getAttribute('href'));
    if(code)return imageFromCode(code);
    return imageFromStaticName(findName(anchor,card));
  }
  function imageFromProductHref(href){
    var code=codeFromHref(href);
    return code?imageFromCode(code):'';
  }
  function cardRoot(anchor){
    return anchor.closest&&anchor.closest('.v-product, .product, .product-card, .product-wrapper, .product-row, td, li, article, div')||anchor;
  }
  function productsFromDoc(doc,collection,current){
    var seen={};
    return qa('a[href]',doc).map(function(anchor){
      var href=abs(anchor.getAttribute('href'));
      if(!href||!/product|product-p|\/p\/|ProductDetails\.asp|-p\//i.test(href))return null;
      var card=cardRoot(anchor);
      var name=findName(anchor,card);
      if(!name||name.toLowerCase()===current.toLowerCase())return null;
      if(name.toLowerCase().indexOf(collection.toLowerCase())===-1)return null;
      if(!PIECE_RE.test(name))return null;
      if(productUrlMatchesCurrent(href))return null;
      var key=href.split('#')[0].split('?')[0].toLowerCase();
      if(seen[key])return null;
      seen[key]=!0;
      return {name:name,href:href,image:findImage(anchor,card),price:findPrice(card)};
    }).filter(Boolean);
  }
  function productsFromStatic(collection){
    var currentCode=currentProductCode();
    return STATIC_PRODUCTS.filter(function(product){
      return product.co.toLowerCase()===collection.toLowerCase()&&product.c.toUpperCase()!==currentCode;
    }).map(function(product){
      return{
        name:product.n,
        href:'/product-p/'+product.c.toLowerCase()+'.htm',
        image:imageFromCode(product.c),
        price:''
      };
    });
  }
  function searchUrl(collection){
    return'/SearchResults.asp?Search='+encodeURIComponent(collection);
  }
  function addCss(){
    if(q('#'+STYLE_ID))return;
    var st=d.createElement('style');
    st.id=STYLE_ID;
    st.textContent=[
      '#'+SECTION_ID+'{clear:both;margin:34px 0 26px;padding:22px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;font-family:Inter,Arial,sans-serif}',
      '#'+SECTION_ID+' .mc-collection-heading{margin:0 0 16px;color:#222;font-size:22px;font-weight:400;line-height:1.25;letter-spacing:0;text-transform:none}',
      '#'+SECTION_ID+' .mc-collection-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:18px}',
      '#'+SECTION_ID+' .mc-collection-card{display:block;color:#333;text-decoration:none}',
      '#'+SECTION_ID+' .mc-collection-image{display:block;width:100%;aspect-ratio:1/1;background:#f6f4f0;border:1px solid #ddd;overflow:hidden}',
      '#'+SECTION_ID+' .mc-collection-image img{display:block;width:100%;height:100%;object-fit:contain}',
      '#'+SECTION_ID+' .mc-collection-name{display:block;margin:9px 0 0;font-size:14px;line-height:1.35;color:#333}',
      '#'+SECTION_ID+' .mc-collection-price{display:block;margin:4px 0 0;font-size:13px;line-height:1.3;color:#666}',
      '#'+SECTION_ID+' .mc-collection-card:hover .mc-collection-name{text-decoration:underline}',
      '@media(max-width:640px){#'+SECTION_ID+'{margin:26px 0 22px;padding:18px 0}#'+SECTION_ID+' .mc-collection-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}#'+SECTION_ID+' .mc-collection-heading{font-size:20px}}'
    ].join('');
    (d.head||d.documentElement).appendChild(st);
  }
  function relatedAnchor(){
    return q('#v65-product-related, #related_products_content, .related_products, .related-items');
  }
  function render(products,collection){
    if(!products.length||q('#'+SECTION_ID))return;
    addCss();

    var section=d.createElement('section');
    section.id=SECTION_ID;
    section.setAttribute('data-mc-collection-source',collection);
    section.setAttribute('aria-labelledby','mc-bedroom-collection-heading');

    var h=d.createElement('h2');
    h.id='mc-bedroom-collection-heading';
    h.className='mc-collection-heading';
    h.textContent='The Collection';
    section.appendChild(h);

    var grid=d.createElement('div');
    grid.className='mc-collection-grid';
    products.forEach(function(product){
      var a=d.createElement('a');
      a.className='mc-collection-card';
      a.href=product.href;

      var image=d.createElement('span');
      image.className='mc-collection-image';
      var src=product.image||imageFromProductHref(product.href)||imageFromStaticName(product.name);
      if(src){
        var img=d.createElement('img');
        img.loading='lazy';
        img.alt=product.name;
        img.src=src;
        img.onerror=function(){
          var full=String(src||'').replace(/-1T\.jpg/i,'-1.jpg');
          var fromName=imageFromStaticName(product.name);
          if(full&&full!==src){ img.onerror=null; img.src=full; }
          else if(fromName&&fromName!==src){ img.onerror=null; img.src=fromName; }
          else if(image.parentNode){ image.style.display='none'; }
        };
        image.appendChild(img);
      }
      a.appendChild(image);

      var name=d.createElement('span');
      name.className='mc-collection-name';
      name.textContent=product.name;
      a.appendChild(name);

      if(product.price){
        var price=d.createElement('span');
        price.className='mc-collection-price';
        price.textContent=product.price;
        a.appendChild(price);
      }
      grid.appendChild(a);
    });
    section.appendChild(grid);
    var related=relatedAnchor();
    if(related&&related.parentNode){
      related.parentNode.insertBefore(section,related);
    }else{
      var host=q('#v65-product-parent')||q('#content_area')||q('main')||d.body;
      if(host&&host.parentNode)host.parentNode.insertBefore(section,host.nextSibling);
    }
  }
  function boot(){
    var name=currentName();
    var collection=collectionFromName(name);
    if(!collection)return;
    var staticProducts=productsFromStatic(collection);
    if(staticProducts.length){
      render(staticProducts,collection);
      return;
    }
    fetch(searchUrl(collection),{credentials:'same-origin'})
      .then(function(r){return r.text()})
      .then(function(html){
        var doc=new DOMParser().parseFromString(html,'text/html');
        var products=productsFromDoc(doc,collection,name);
        render(products,collection);
      })
      .catch(function(){});
  }
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot);
  else boot();
}(window,document);
