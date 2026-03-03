$url = 'https://www.mccabestheaterandliving.com/Palliser-Sherbrook-Sofa-p/77407.htm?cb=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$html = (Invoke-WebRequest -Uri $url -UseBasicParsing).Content

$checks = @(
  'id="product_photo"',
  'id="v65-product-parent"',
  'itemprop="offers"',
  'custom-safe.css\?v=100290',
  'templates/266/css/template.css'
)
foreach($c in $checks){
  Write-Output ("$c => " + [bool]($html -match $c))
}

$m = [regex]::Match($html, '<img[^>]*id="product_photo"[^>]*>', 'IgnoreCase')
if($m.Success){
  Write-Output 'PRODUCT_IMG_TAG_START'
  Write-Output $m.Value
  Write-Output 'PRODUCT_IMG_TAG_END'
}

$m2 = [regex]::Match($html, "<a[^>]*id=['\"']product_photo_zoom_url['\"'][^>]*>", 'IgnoreCase')
if($m2.Success){
  Write-Output 'ZOOM_LINK_TAG_START'
  Write-Output $m2.Value
  Write-Output 'ZOOM_LINK_TAG_END'
}
