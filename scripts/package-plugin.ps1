[CmdletBinding()]
param(
    [string]$OutputPath = "dist/structured-writing.plugin"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pluginManifest = Join-Path $repoRoot ".claude-plugin/plugin.json"
$manifest = Get-Content -LiteralPath $pluginManifest -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($manifest.name)) {
    throw "The plugin manifest must define a name."
}

$resolvedOutputPath = if ([IO.Path]::IsPathRooted($OutputPath)) {
    [IO.Path]::GetFullPath($OutputPath)
} else {
    [IO.Path]::GetFullPath((Join-Path $repoRoot $OutputPath))
}

$outputDirectory = Split-Path -Parent $resolvedOutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$stagingDirectory = Join-Path ([IO.Path]::GetTempPath()) ("structured-writing-plugin-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $stagingDirectory | Out-Null

$packageEntries = @(
    ".claude-plugin",
    "skills",
    "README.md",
    "LICENSE"
)

try {
    foreach ($entry in $packageEntries) {
        $sourcePath = Join-Path $repoRoot $entry
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Required package entry is missing: $entry"
        }

        Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $stagingDirectory $entry) -Recurse -Force
    }

    if (Test-Path -LiteralPath $resolvedOutputPath) {
        Remove-Item -LiteralPath $resolvedOutputPath -Force
    }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory(
        $stagingDirectory,
        $resolvedOutputPath,
        [IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    $sizeKb = [Math]::Round((Get-Item -LiteralPath $resolvedOutputPath).Length / 1KB, 1)
    Write-Host "Created $resolvedOutputPath ($sizeKb KB, version $($manifest.version))"
} finally {
    if (Test-Path -LiteralPath $stagingDirectory) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }
}
