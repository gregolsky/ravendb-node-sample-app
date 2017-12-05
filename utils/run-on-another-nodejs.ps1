param (
    [string]$NodeVersion = "6.11",
    [switch]$Serve = $false
 )

& npm unlink ravendb
& git clean -xfd

& nvm use $NodeVersion
Start-Sleep -Seconds 1

& npm install

& npm link ravendb

$ravendbPkg = Get-Content .\node_modules\ravendb\package.json | ConvertFrom-Json
Write-Host "RavenDB package version: $($ravendbPkg.version)"

if ($Serve) {
    & npm run serve
}
