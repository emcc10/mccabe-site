$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
Import-Module Posh-SSH -Force
$cfg = Get-Content '.vscode/sftp.json' | ConvertFrom-Json
$secure = ConvertTo-SecureString $cfg.password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($cfg.username,$secure)
$s = New-SFTPSession -ComputerName $cfg.host -Port $cfg.port -Credential $cred -AcceptKey
try {
  Set-SFTPItem -SessionId $s.SessionId -Path '.\template_266.html' -Destination '/' -Force
  Set-SFTPItem -SessionId $s.SessionId -Path '.\vspfiles\templates\266\css\template.css' -Destination '/vspfiles/templates/266/css/' -Force
  Set-SFTPItem -SessionId $s.SessionId -Path '.\vspfiles\css\custom-safe.css' -Destination '/vspfiles/css/' -Force
  Set-SFTPItem -SessionId $s.SessionId -Path '.\vspfiles\templates\266\js\min\template.min.js' -Destination '/vspfiles/templates/266/js/min/' -Force
  Set-SFTPItem -SessionId $s.SessionId -Path '.\vspfiles\templates\266\js\min\design-toolkit.min.js' -Destination '/vspfiles/templates/266/js/min/' -Force
  Write-Output 'UPLOAD_OK'
}
finally {
  if($s){ Remove-SFTPSession -SessionId $s.SessionId | Out-Null }
}
