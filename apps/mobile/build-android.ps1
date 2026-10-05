$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
$previousNoVcs = $env:EAS_NO_VCS
$previousRoot = $env:EAS_PROJECT_ROOT
try {
    # This mobile app has its own lockfile. Exclude the parent web/backend repository.
    $env:EAS_NO_VCS = '1'
    $env:EAS_PROJECT_ROOT = $PSScriptRoot
    & npm.cmd run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Mobile typecheck failed.' }
    & npm.cmd run lint
    if ($LASTEXITCODE -ne 0) { throw 'Mobile lint failed.' }
    & npx.cmd --yes eas-cli@latest build --platform android --profile preview
    if ($LASTEXITCODE -ne 0) { throw 'Expo APK build did not complete.' }
} finally {
    $env:EAS_NO_VCS = $previousNoVcs
    $env:EAS_PROJECT_ROOT = $previousRoot
    Pop-Location
}
