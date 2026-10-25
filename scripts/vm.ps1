[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('start', 'stop', 'status', 'logs')]
    [string]$Action = 'start',
    [string]$Vm = 'dockervm',
    [string]$RemoteDirectory = 'projects/ticketsystem-manual-20261025',
    [string]$Project = 'ticketsystem-manual-20261025'
)

$ErrorActionPreference = 'Stop'
if ($Vm -notmatch '^[a-zA-Z0-9_@.-]+$' -or $Vm.StartsWith('-')) {
    throw 'Invalid SSH destination.'
}
if ($RemoteDirectory -notmatch '^[a-zA-Z0-9_./-]+$' -or
    $RemoteDirectory.StartsWith('/') -or $RemoteDirectory -match '(^|/)\.\.(/|$)') {
    throw 'RemoteDirectory must be a relative path inside the remote home directory.'
}
if ($Project -notmatch '^[a-z0-9][a-z0-9_-]+$') {
    throw 'Invalid Compose project name.'
}

$sshOptions = @('-o', 'BatchMode=yes', '-o', 'IPQoS=none',
    '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=10', '-o', 'ServerAliveCountMax=3')
$root = Split-Path $PSScriptRoot -Parent

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program failed (exit code $LASTEXITCODE)."
    }
}

if ($Action -eq 'start') {
    $id = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
    $archive = Join-Path ([IO.Path]::GetTempPath()) "ticketsystem-$id.tar.gz"
    try {
        Invoke-Checked tar (@('-czf', $archive,
            '--exclude=.git', '--exclude=.venv', '--exclude=node_modules',
            '--exclude=build', '--exclude=dist', '--exclude=storage',
            '--exclude=__pycache__', '--exclude=.pytest_cache', '--exclude=.mypy_cache',
            '--exclude=.ruff_cache', '--exclude=.env', '--exclude=.env.*',
            '-C', $root, 'backend', 'frontend', 'scripts/vm'))
        Invoke-Checked ssh ($sshOptions + @($Vm, "mkdir -p ~/$RemoteDirectory/releases/$id"))
        Invoke-Checked scp ($sshOptions + @($archive, "${Vm}:$RemoteDirectory/releases/$id/source.tar.gz"))
        $release = "~/$RemoteDirectory/releases/$id"
        Invoke-Checked ssh ($sshOptions + @($Vm,
            "cd $release && tar -xzf source.tar.gz && sh scripts/vm/control.sh start '$Project'"))
        Write-Host "TicketSystem: http://${Vm}:8080"
        Write-Host 'Initial test login: admin / TicketTest2026! (existing passwords are preserved).'
    }
    finally {
        if (Test-Path -LiteralPath $archive) {
            Remove-Item -LiteralPath $archive
        }
    }
}
else {
    # These operations also work with the original manually created containers.
    $filter = "label=com.docker.compose.project=$Project"
    switch ($Action) {
        'stop' { $command = "ids=`$(docker ps -q --filter '$filter'); if [ -n `"`$ids`" ]; then docker stop `$ids; fi" }
        'status' { $command = "docker ps -a --filter '$filter'" }
        'logs' { $command = "for id in `$(docker ps -aq --filter '$filter'); do docker logs --tail 80 `$id; done" }
    }
    Invoke-Checked ssh ($sshOptions + @($Vm, "set -eu; $command"))
}
