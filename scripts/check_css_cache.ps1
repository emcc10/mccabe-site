$urls = @(
  'https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css?v=100290',
  'https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css?v=20260302b',
  'https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/css/template.css?cb=20260302-proof2'
)

foreach ($url in $urls) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing
    $content = $response.Content
    Write-Output "URL=$url"
    Write-Output "CF=$($response.Headers['CF-Cache-Status'])"
    Write-Output "Len=$($content.Length)"
    Write-Output "HasFinalOverrideMarker=$([bool]($content -match 'FINAL MOBILE OVERRIDE'))"
    Write-Output "Has92vw=$([bool]($content -match 'width:\s*92vw\s*!important'))"
    Write-Output '---'
  }
  catch {
    Write-Output "URL=$url"
    Write-Output "ERROR=$($_.Exception.Message)"
    Write-Output '---'
  }
}
