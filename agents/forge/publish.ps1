# Forge Publisher — builds the plugin and installs it locally.
#
# This is a convenience wrapper around build-plugin.ps1.
# The plugin system is now the canonical distribution method.
#
# Usage:
#   .\publish.ps1                # build + install plugin
#   .\publish.ps1 -DryRun        # preview without installing

param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot  = (Resolve-Path "$ScriptDir\..\..").Path

Write-Host "🔨 Forge Publisher (via plugin system)"
Write-Host ""

# Build the plugin
$buildArgs = @()
if ($DryRun) { $buildArgs += '-DryRun' }
& "$RepoRoot\build-plugin.ps1" @buildArgs

# Install unless dry-run
if (-not $DryRun) {
    Write-Host ""
    Write-Host "🚀 Installing plugin..."
    try { copilot plugin uninstall forge 2>$null } catch {}
    copilot plugin install "$RepoRoot\dist"
    Write-Host ""
    copilot plugin list
}
