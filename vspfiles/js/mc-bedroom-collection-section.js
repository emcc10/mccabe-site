/* MC_BEDROOM_COLLECTION_SECTION_20260620 */
!function(w,d){
  'use strict';

  if(!w||!d||w.__MC_BEDROOM_COLLECTION_SECTION_20260620__)return;
  w.__MC_BEDROOM_COLLECTION_SECTION_20260620__=!0;

  var PIECE_RE=/\b(chest|dresser|king bed|queen bed|bed|nightstand|night stand|mirror|armoire|wardrobe|media chest|gentlemans chest|gentleman's chest|drawer chest|door chest|bachelor chest|california king bed|cal king bed|twin bed|full bed)\b/i;
  var STYLE_ID='mc-bedroom-collection-css';
  var SECTION_ID='mc-bedroom-collection';

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
      q('[itemprop="name"]'),
      q('#productname'),
      q('.productnamecolorLARGE'),
      q('.productnamecolor'),
      q('h1'),
      q('meta[property="og:title"]'),
      q('meta[name="twitter:title"]')
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

    var match=name.match(new RegExp('^(.*?)\\s+'+PIECE_RE.source+'(?:\\s|$)','i'));
    if(match&&match[1])return cleanName(match[1]);

    var words=name.split(/\s+/);
    if(/^the$/i.test(words[0])&&words.length>2)return words.slice(0,2).join(' ');
    if(words.length>1)return words[0];
    return'';
  }
  function productCode(){
    return String(w.global_Current_ProductCode||
      (q('input[name="ProductCode"]')&&q('input[name="ProductCode"]').value)||
      (q('[name="ProductCode"]')&&q('[name="ProductCode"]').value)||'').toLowerCase();
  }
  function productUrlMatchesCurrent(url){
    var href=String(url||'').toLowerCase();
    var code=productCode();
    return href&&(
      href.replace(/\/$/,'')===String(w.location.href).toLowerCase().replace(/\/$/,'')||
      href.replace(/\/$/,'')===String(w.location.pathname).toLowerCase().replace(/\/$/,'')||
      (code&&href.indexOf(code)>-1)
    );
  }
  function relatedAnchor(){
    var direct=q('#related_products')||
      q('#ProductDetail_ProductDetails_divRelatedProducts')||
      q('[id*="RelatedProducts"]')||
      q('.related-products')||
      q('.v65-product-related');
    if(direct)return direct;

    var headings=qa('h2,h3,h4,.v65-product-related-header,.related-title,.section-title');
    for(var i=0;i<headings.length;i++){
      if(/related\s+items|you\s+may\s+also\s+like|related\s+products/i.test(text(headings[i]))){
        return headings[i].closest&&headings[i].closest('table,section,div')||headings[i];
      }
    }
    return null;
  }
  function insertBeforeRelated(section){
    var related=relatedAnchor();
    if(related&&related.parentNode){
      related.parentNode.insertBefore(section,related);
      return;
    }
    var host=q('#v65-product-parent')||q('#content_area')||q('main')||d.body;
    if(host&&host.parentNode)host.parentNode.insertBefore(section,host.nextSibling);
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
  function findName(anchor,card){
    var img=q('img',anchor)||q('img',card);
    return cleanName(
      text(q('.productnamecolor, .productnamecolorSMALL, .product-name, .productname, [itemprop="name"]',card))||
      text(anchor)||
      (img&&(img.alt||img.title))||
      anchor.title
    );
  }
  function findPrice(card){
    return text(q('.productprice, .price, [itemprop="price"], .saleprice, .ourprice',card));
  }
  function findImage(anchor,card){
    var img=q('img',anchor)||q('img',card);
    return img?abs(img.getAttribute('data-src')||img.getAttribute('data-original')||img.getAttribute('src')):'';
  }
  function cardRoot(anchor){
    return anchor.closest&&anchor.closest('.v-product, .product, .product-card, .product-wrapper, .product-row, td, li, article, div')||anchor;
  }
  function productsFromDoc(doc,collection,current){
    var seen={};
    return qa('a[href]',doc).map(function(anchor){
      var href=abs(anchor.getAttribute('href'));
      if(!href||!/product|\/p\/|ProductDetails\.asp|-p\//i.test(href))return null;
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
  function searchUrl(collection){
    return '/SearchResults.asp?Search='+encodeURIComponent(collection);
  }
  function render(products,collection){
    if(!products.length||q('#'+SECTION_ID))return;
    addCss();

    var section=d.createElement('section');
    section.id=SECTION_ID;
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
      if(product.image){
        var img=d.createElement('img');
        img.loading='lazy';
        img.alt=product.name;
        img.src=product.image;
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
    insertBeforeRelated(section);
  }
  function run(){
    if(q('#'+SECTION_ID))return;
    var name=currentName();
    var collection=collectionFromName(name);
    if(!collection)return;

    fetch(searchUrl(collection),{credentials:'same-origin'})
      .then(function(res){return res.ok?res.text():''})
      .then(function(html){
        if(!html)return;
        var doc=new DOMParser().parseFromString(html,'text/html');
        var products=productsFromDoc(doc,collection,name);
        render(products,collection);
      })
      .catch(function(){});
  }

  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',run);
  else run();
  w.addEventListener&&w.addEventListener('load',run);
  setTimeout(run,500);
  setTimeout(run,1600);
}(window,document);
