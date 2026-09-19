param(
  [string]$BackupFile = "./backups/facilityflow-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path (Split-Path $BackupFile) | Out-Null
pg_dump $env:DATABASE_URL --format=custom --file=$BackupFile
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }

$databaseUrl = [System.Uri]$env:DATABASE_URL
$targetDb = "$($databaseUrl.AbsolutePath.TrimStart('/'))_restore_check"
psql $env:DATABASE_URL -c "DROP DATABASE IF EXISTS `"$targetDb`";" | Out-Null
psql $env:DATABASE_URL -c "CREATE DATABASE `"$targetDb`";" | Out-Null
$restoreUrl = "$($databaseUrl.Scheme)://$($databaseUrl.UserInfo)@$($databaseUrl.Host):$($databaseUrl.Port)/$targetDb"
pg_restore --dbname=$restoreUrl --no-owner --no-acl $BackupFile
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed" }
psql $env:DATABASE_URL -c "DROP DATABASE `"$targetDb`";" | Out-Null
Write-Output "Backup and restore check passed: $BackupFile"
