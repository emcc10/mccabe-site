$ErrorActionPreference = 'Stop'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
Import-Module Posh-SSH -Force
$cfg = Get-Content '.vscode/sftp.json' | ConvertFrom-Json
$secure = ConvertTo-SecureString $cfg.password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($cfg.username,$secure)
$s = New-SFTPSession -ComputerName $cfg.host -Port $cfg.port -Credential $cred -AcceptKey
try {
  $paths = @('/mccabestheaterandliving.com','/mccabestheaterandliving.com/v','/mccabestheaterandliving.com/v/vspfiles','/mccabestheaterandliving.com/v/vspfiles/templates/266')
  foreach($p in $paths){
    Write-Output "PATH=$p"
    try {
      Get-SFTPChildItem -SessionId $s.SessionId -Path $p | Select-Object Name,FullName,IsDirectory | Format-Table -AutoSize | Out-String | Write-Output
    } catch {
      Write-Output "ERR=$($_.Exception.Message)"
    }
    Write-Output '---'
  }
}
finally {
  if($s){ Remove-SFTPSession -SessionId $s.SessionId | Out-Null }
}
