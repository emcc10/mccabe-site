$url = 'https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css?v=100290'
$content = (Invoke-WebRequest -Uri $url -UseBasicParsing).Content
Set-Content -Path 'vspfiles/css/custom-safe.v100290.css' -Value $content -NoNewline
Write-Output ('Saved=' + (Get-Item 'vspfiles/css/custom-safe.v100290.css').FullName)
Write-Output ('Len=' + $content.Length)
