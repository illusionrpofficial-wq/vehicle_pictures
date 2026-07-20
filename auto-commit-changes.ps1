param(
    [string]$RepoPath = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & git @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        throw ($output -join [Environment]::NewLine)
    }

    return $output
}

try {
    Set-Location -LiteralPath $RepoPath

    Invoke-Git @("rev-parse", "--is-inside-work-tree") | Out-Null
    $branch = (Invoke-Git @("branch", "--show-current") | Select-Object -First 1).Trim()
    if (-not $branch) {
        throw "Nem sikerult megallapitani az aktualis Git branchet."
    }

    Invoke-Git @("add", "-A") | Out-Null

    $changes = Invoke-Git @("diff", "--cached", "--name-status")
    if (-not $changes) {
        Write-Host "Nincs commitolhato valtozas."
        Read-Host "Nyomj Entert a bezarashoz"
        exit 0
    }

    $added = New-Object System.Collections.Generic.List[string]
    $modified = New-Object System.Collections.Generic.List[string]
    $deleted = New-Object System.Collections.Generic.List[string]
    $renamed = New-Object System.Collections.Generic.List[string]
    $other = New-Object System.Collections.Generic.List[string]

    foreach ($line in $changes) {
        $parts = $line -split "`t"
        $status = $parts[0]

        switch -Regex ($status) {
            "^A" { $added.Add($parts[1]); continue }
            "^M" { $modified.Add($parts[1]); continue }
            "^D" { $deleted.Add($parts[1]); continue }
            "^R" { $renamed.Add("$($parts[1]) -> $($parts[2])"); continue }
            default { $other.Add(($parts[1..($parts.Length - 1)] -join " -> ")) }
        }
    }

    $summaryParts = New-Object System.Collections.Generic.List[string]
    if ($added.Count -gt 0) { $summaryParts.Add("added $($added.Count)") }
    if ($modified.Count -gt 0) { $summaryParts.Add("modified $($modified.Count)") }
    if ($deleted.Count -gt 0) { $summaryParts.Add("deleted $($deleted.Count)") }
    if ($renamed.Count -gt 0) { $summaryParts.Add("renamed $($renamed.Count)") }
    if ($other.Count -gt 0) { $summaryParts.Add("other $($other.Count)") }

    $subject = "Update files: " + ($summaryParts -join ", ")

    $bodyLines = New-Object System.Collections.Generic.List[string]
    if ($added.Count -gt 0) {
        $bodyLines.Add("Added:")
        $added | ForEach-Object { $bodyLines.Add("- $_") }
        $bodyLines.Add("")
    }
    if ($modified.Count -gt 0) {
        $bodyLines.Add("Modified:")
        $modified | ForEach-Object { $bodyLines.Add("- $_") }
        $bodyLines.Add("")
    }
    if ($deleted.Count -gt 0) {
        $bodyLines.Add("Deleted:")
        $deleted | ForEach-Object { $bodyLines.Add("- $_") }
        $bodyLines.Add("")
    }
    if ($renamed.Count -gt 0) {
        $bodyLines.Add("Renamed:")
        $renamed | ForEach-Object { $bodyLines.Add("- $_") }
        $bodyLines.Add("")
    }
    if ($other.Count -gt 0) {
        $bodyLines.Add("Other:")
        $other | ForEach-Object { $bodyLines.Add("- $_") }
        $bodyLines.Add("")
    }

    $body = ($bodyLines -join [Environment]::NewLine).Trim()

    Invoke-Git @("commit", "-m", $subject, "-m", $body) | Write-Host

    Write-Host ""
    Write-Host "Commit kesz:"
    Write-Host $subject

    Write-Host ""
    Write-Host "Push indul..."

    $hasUpstream = $true
    try {
        Invoke-Git @("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}") | Out-Null
    }
    catch {
        $hasUpstream = $false
    }

    if ($hasUpstream) {
        Invoke-Git @("push") | Write-Host
    }
    else {
        Invoke-Git @("push", "-u", "origin", $branch) | Write-Host
    }

    Write-Host ""
    Write-Host "Push kesz."
}
catch {
    Write-Host ""
    Write-Host "Hiba tortent:"
    Write-Host $_.Exception.Message
    exit 1
}
finally {
    Write-Host ""
    Read-Host "Nyomj Entert a bezarashoz"
}
