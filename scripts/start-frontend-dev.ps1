param([string]$WorkDir = 'c:\Users\Admin\Desktop\ANUM\Facility Service App\frontend')
Set-Location $WorkDir
$env:NODE_OPTIONS = '--max-old-space-size=4096'
Start-Transcript -Path "$env:TEMP\frontend-dev-transcript.log" -Append
Write-Output "[$(Get-Date -Format HH:mm:ss)] Starting `npm run dev`..."
npm run dev 2>&1 | ForEach-Object {
  $line = $_.ToString()
  if ($line -match 'error|ready|compiled|starting on|failed') {
    Write-Output "[$(Get-Date -Format HH:mm:ss)] $line"
  }
}
