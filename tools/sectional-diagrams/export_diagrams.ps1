# One-command batch export → vspfiles/sectional-diagrams/*.png (then deploy to Volusion).
# Requires Python 3 + pip. From repo root:
#   .\tools\sectional-diagrams\export_diagrams.ps1

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$py = Get-Command py -ErrorAction SilentlyContinue
if ($py) {
  & py -3 -m pip install -r requirements.txt
  & py -3 .\export_sectional_diagrams.py --publish @args
} else {
  & python -m pip install -r requirements.txt
  & python .\export_sectional_diagrams.py --publish @args
}
