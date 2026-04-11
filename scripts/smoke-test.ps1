param(
    [string]$BindHost = "127.0.0.1",
    [int]$Port = 8010,
    [string]$PythonExe = ".\\.venv\\Scripts\\python.exe"
)

$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

$baseUrl = "http://$BindHost`:$Port"
$serverProcess = $null

try {
    if (-not (Test-Path $PythonExe)) {
        throw "Python executable not found at $PythonExe"
    }

    Write-Host "Starting test server on $baseUrl ..."
    $serverProcess = Start-Process -FilePath $PythonExe -ArgumentList "-m", "uvicorn", "app.main:app", "--host", $BindHost, "--port", "$Port" -PassThru -WindowStyle Hidden

    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $health = Invoke-WebRequest -Uri "$baseUrl/login" -Method Get -TimeoutSec 2
            if ($health.StatusCode -ge 200 -and $health.StatusCode -lt 500) {
                $ready = $true
                break
            }
        } catch {
            # keep waiting for server boot
        }

        Start-Sleep -Milliseconds 250
    }

    Assert-True -Condition $ready -Message "Server did not become ready in time."

    $email = "smoke_$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
    $password = "StrongPass123"
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

    $signupBody = @{
        full_name = "Smoke User"
        email = $email
        password = $password
    } | ConvertTo-Json

    $signup = Invoke-RestMethod -Uri "$baseUrl/auth/signup" -Method Post -WebSession $session -ContentType "application/json" -Body $signupBody
    Assert-True -Condition ($signup.user.email -eq $email) -Message "Signup failed: unexpected user email."

    $txBody = @{
        amount = 25.75
        type = "expense"
        category = "Food & Drink"
        description = "smoke-test"
        date = (Get-Date -Format "yyyy-MM-dd")
    } | ConvertTo-Json

    $tx = Invoke-RestMethod -Uri "$baseUrl/add-transaction" -Method Post -WebSession $session -ContentType "application/json" -Body $txBody
    Assert-True -Condition ([int]$tx.id -gt 0) -Message "Add transaction failed: invalid transaction id."

    $transactions = Invoke-RestMethod -Uri "$baseUrl/transactions?page=1&page_size=10" -Method Get -WebSession $session
    Assert-True -Condition ([int]$transactions.total -ge 1) -Message "Transactions list failed: expected at least one record."

    $summary = Invoke-RestMethod -Uri "$baseUrl/dashboard-summary" -Method Get -WebSession $session
    Assert-True -Condition ($null -ne $summary.total_balance) -Message "Dashboard summary failed: missing total_balance."

    $claim = Invoke-RestMethod -Uri "$baseUrl/auth/claim-legacy-transactions" -Method Post -WebSession $session -ContentType "application/json" -Body "{}"
    Assert-True -Condition ($null -ne $claim.migrated_count) -Message "Claim legacy endpoint failed."

    $null = Invoke-RestMethod -Uri "$baseUrl/auth/logout" -Method Post -WebSession $session -ContentType "application/json" -Body "{}"

    $unauthorizedOk = $false
    try {
        $null = Invoke-RestMethod -Uri "$baseUrl/transactions?page=1&page_size=10" -Method Get -WebSession $session
    } catch {
        if ([int]$_.Exception.Response.StatusCode -eq 401) {
            $unauthorizedOk = $true
        }
    }
    Assert-True -Condition $unauthorizedOk -Message "Expected 401 after logout, but request was not unauthorized."

    $session2 = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $loginBody = @{ email = $email; password = $password } | ConvertTo-Json
    $login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -WebSession $session2 -ContentType "application/json" -Body $loginBody
    Assert-True -Condition ($login.message -match "Signed in") -Message "Login failed."

    $me = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Method Get -WebSession $session2
    Assert-True -Condition ($me.email -eq $email) -Message "Auth me failed: wrong user returned."

    Write-Host ""
    Write-Host "Smoke test passed."
    Write-Host "  User: $email"
    Write-Host "  Transaction ID: $($tx.id)"
    Write-Host "  Claimed legacy count: $($claim.migrated_count)"
    exit 0
}
catch {
    Write-Error "Smoke test failed: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force
    }
}
