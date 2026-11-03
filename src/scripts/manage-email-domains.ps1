
$BaseUrl = "http://localhost:3000"

function Show-Error($ErrorRecord) {
    if ($ErrorRecord.ErrorDetails.Message) {
        Write-Host $ErrorRecord.ErrorDetails.Message -ForegroundColor Red
    } else {
        Write-Host $ErrorRecord.Exception.Message -ForegroundColor Red
    }
}

function Invoke-DomainApi {
    param(
        [string]$Method,
        [string]$Body = ""
    )

    $Params = @{
        Uri = "$BaseUrl/api/admin/email-domains"
        Method = $Method
        WebSession = $AdminSession
        ContentType = "application/json"
    }

    if ($Body) {
        $Params.Body = $Body
    }

    Invoke-RestMethod @Params
}

# ----------------------------------------
# ADMIN LOGIN
# ----------------------------------------

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "     SEASIA EMAIL DOMAIN MANAGER"
Write-Host "======================================" -ForegroundColor Cyan

$AdminEmail = Read-Host "Super Admin email"
$SecurePassword = Read-Host "Super Admin password" -AsSecureString

$Pointer = [IntPtr]::Zero

try {
    $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)

    $LoginBody = @{
        email = $AdminEmail.Trim()
        password = $Password
    } | ConvertTo-Json

    Write-Host "`nLogging in..." -ForegroundColor Yellow

    $LoginResponse = Invoke-RestMethod `
        -Uri "$BaseUrl/api/admin/login" `
        -Method POST `
        -ContentType "application/json" `
        -SessionVariable AdminSession `
        -Body $LoginBody

    if (-not $LoginResponse.success) {
        throw "Login unsuccessful."
    }

    Write-Host "Login successful! Welcome $($LoginResponse.admin.fullName)" -ForegroundColor Green
}
catch {
    Write-Host "`nLogin failed." -ForegroundColor Red
    Show-Error $_
    exit 1
}
finally {
    if ($Pointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
    }

    $Password = $null
    $LoginBody = $null
    $SecurePassword.Dispose()
}

# ----------------------------------------
# MAIN MENU
# ----------------------------------------

while ($true) {
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "              MAIN MENU"
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "1. View all email domains"
    Write-Host "2. Add allowed domain"
    Write-Host "3. Add blocked domain"
    Write-Host "4. Enable domain rule"
    Write-Host "5. Disable domain rule"
    Write-Host "6. Change domain policy"
    Write-Host "7. Delete Admin domain rule"
    Write-Host "8. Exit"
    Write-Host ""

    $Choice = Read-Host "Select an option"

    switch ($Choice) {

        # VIEW ALL DOMAINS
        "1" {
            try {
                $Response = Invoke-DomainApi -Method "GET"

                Write-Host "`nALL OFFICIAL EMAIL DOMAINS" -ForegroundColor Cyan
                Write-Host "----------------------------------------------"

                $Response.domains |
                    Select-Object domain, source, adminPolicy, adminRuleActive, effectivePolicy |
                    Format-Table -AutoSize

                Write-Host "Total domains: $($Response.total)"
            }
            catch {
                Show-Error $_
            }
        }

        # ADD ALLOWED DOMAIN
        "2" {
            $Domain = (Read-Host "Enter domain to ALLOW").Trim().ToLower()

            $Body = @{
                domain = $Domain
                policy = "ALLOW"
            } | ConvertTo-Json

            try {
                $Response = Invoke-DomainApi -Method "POST" -Body $Body
                Write-Host $Response.message -ForegroundColor Green
            }
            catch {
                Show-Error $_
            }
        }

        # ADD BLOCKED DOMAIN
        "3" {
            $Domain = (Read-Host "Enter domain to BLOCK").Trim().ToLower()

            $Body = @{
                domain = $Domain
                policy = "BLOCK"
            } | ConvertTo-Json

            try {
                $Response = Invoke-DomainApi -Method "POST" -Body $Body
                Write-Host $Response.message -ForegroundColor Green
            }
            catch {
                Show-Error $_
            }
        }

        # ENABLE DOMAIN
        "4" {
            $Domain = (Read-Host "Enter domain to ENABLE").Trim().ToLower()

            $Body = @{
                domain = $Domain
                isActive = $true
            } | ConvertTo-Json

            try {
                $Response = Invoke-DomainApi -Method "PATCH" -Body $Body
                Write-Host $Response.message -ForegroundColor Green
            }
            catch {
                Show-Error $_
            }
        }

        # DISABLE DOMAIN
        "5" {
            $Domain = (Read-Host "Enter domain to DISABLE").Trim().ToLower()

            $Body = @{
                domain = $Domain
                isActive = $false
            } | ConvertTo-Json

            try {
                $Response = Invoke-DomainApi -Method "PATCH" -Body $Body
                Write-Host $Response.message -ForegroundColor Green
            }
            catch {
                Show-Error $_
            }
        }

        # CHANGE POLICY
        "6" {
            $Domain = (Read-Host "Enter domain").Trim().ToLower()

            Write-Host "1. ALLOW"
            Write-Host "2. BLOCK"

            $PolicyChoice = Read-Host "Select policy"

            $Policy = switch ($PolicyChoice) {
                "1" { "ALLOW" }
                "2" { "BLOCK" }
                default { $null }
            }

            if (-not $Policy) {
                Write-Host "Invalid policy selection." -ForegroundColor Red
                continue
            }

            $Body = @{
                domain = $Domain
                policy = $Policy
            } | ConvertTo-Json

            try {
                $Response = Invoke-DomainApi -Method "PATCH" -Body $Body
                Write-Host $Response.message -ForegroundColor Green
            }
            catch {
                Show-Error $_
            }
        }

        # DELETE ADMIN RULE
        "7" {
            $Domain = (Read-Host "Enter domain to DELETE").Trim().ToLower()

            Write-Host "This removes only the Admin rule."
            Write-Host "Hardcoded policy, if any, will become effective again."

            $Confirm = Read-Host "Type YES to confirm"

            if ($Confirm -ne "YES") {
                Write-Host "Deletion cancelled." -ForegroundColor Yellow
                continue
            }

            $Body = @{
                domain = $Domain
            } | ConvertTo-Json

            try {
                $Response = Invoke-DomainApi -Method "DELETE" -Body $Body
                Write-Host $Response.message -ForegroundColor Green
            }
            catch {
                Show-Error $_
            }
        }

        # EXIT
        "8" {
            Write-Host "Goodbye!" -ForegroundColor Cyan
            break
        }

        default {
            Write-Host "Invalid option." -ForegroundColor Red
        }
    }

    if ($Choice -eq "8") {
        break
    }
}
