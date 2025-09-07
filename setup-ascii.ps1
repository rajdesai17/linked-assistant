# LinkedIn Connection Assistant - Setup Script for Windows PowerShell
# This script helps with development setup, testing, and deployment preparation

param(
    [Parameter(HelpMessage="Action to perform: setup, test, package, or clean")]
    [ValidateSet("setup", "test", "package", "clean")]
    [string]$Action = "setup"
)

# Set script preferences
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Constants
$ExtensionName = "LinkedIn Connection Assistant"
$ExtensionDir = $PSScriptRoot
$PackageDir = Join-Path $ExtensionDir "package"
$TestResultsDir = Join-Path $ExtensionDir "test-results"

# Colors for output
$Colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "Cyan"
    Header = "Magenta"
}

function Write-ColorOutput {
    param($Message, $Color = "White")
    $fgColor = $Colors[$Color]
    if (-not $fgColor) { $fgColor = "White" }
    Write-Host $Message -ForegroundColor $fgColor
}

function Show-Header {
    param($Title)
    Write-Host ""
    Write-ColorOutput "=" * 60 -Color "Header"
    Write-ColorOutput " $Title" -Color "Header"
    Write-ColorOutput "=" * 60 -Color "Header"
    Write-Host ""
}

function Test-Prerequisites {
    Show-Header "Checking Prerequisites"
    
    # Check if running on Windows
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Write-ColorOutput "PowerShell 5.0 or higher is required" -Color "Error"
        exit 1
    }
    
    # Check for Chrome installation
    $chromeLocations = @(
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
    )
    
    $chromeFound = $false
    foreach ($location in $chromeLocations) {
        if (Test-Path $location) {
            Write-ColorOutput "[OK] Google Chrome found at: $location" -Color "Success"
            $chromeFound = $true
            break
        }
    }
    
    if (-not $chromeFound) {
        Write-ColorOutput "[WARN] Google Chrome not found. Please install Chrome to test the extension." -Color "Warning"
    }
    
    # Check required files
    $requiredFiles = @(
        "manifest.json",
        "popup.html",
        "popup.js",
        "content.js",
        "background.js",
        "styles.css"
    )
    
    Write-ColorOutput "Checking required extension files:" -Color "Info"
    $allFilesPresent = $true
    
    foreach ($file in $requiredFiles) {
        $filePath = Join-Path $ExtensionDir $file
        if (Test-Path $filePath) {
            $fileSize = (Get-Item $filePath).Length
            Write-ColorOutput "[OK] $file ($fileSize bytes)" -Color "Success"
        } else {
            Write-ColorOutput "[FAIL] $file (missing)" -Color "Error"
            $allFilesPresent = $false
        }
    }
    
    if ($allFilesPresent) {
        Write-ColorOutput "All required files are present!" -Color "Success"
    } else {
        Write-ColorOutput "Some required files are missing!" -Color "Error"
        exit 1
    }
}

function Start-DevelopmentSetup {
    Show-Header "Setting Up Development Environment"
    
    # Create development directories
    $devDirs = @($PackageDir, $TestResultsDir)
    foreach ($dir in $devDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-ColorOutput "[OK] Created directory: $dir" -Color "Success"
        }
    }
    
    # Validate manifest.json
    Write-ColorOutput "Validating manifest.json..." -Color "Info"
    try {
        $manifest = Get-Content "manifest.json" | ConvertFrom-Json
        Write-ColorOutput "[OK] Manifest name: $($manifest.name)" -Color "Success"
        Write-ColorOutput "[OK] Manifest version: $($manifest.version)" -Color "Success"
        Write-ColorOutput "[OK] Manifest version: $($manifest.manifest_version)" -Color "Success"
        
        # Check permissions
        if ($manifest.permissions -contains "activeTab" -and $manifest.permissions -contains "storage") {
            Write-ColorOutput "[OK] Required permissions are present" -Color "Success"
        } else {
            Write-ColorOutput "[WARN] Check permissions in manifest.json" -Color "Warning"
        }
        
    } catch {
        Write-ColorOutput "[FAIL] Error validating manifest.json: $($_.Exception.Message)" -Color "Error"
        exit 1
    }
    
    Write-ColorOutput "Development environment setup complete!" -Color "Success"
    Write-ColorOutput "Next steps:" -Color "Info"
    Write-ColorOutput "1. Open Chrome and go to chrome://extensions/" -Color "Info"
    Write-ColorOutput "2. Enable 'Developer mode'" -Color "Info"
    Write-ColorOutput "3. Click 'Load unpacked' and select this directory" -Color "Info"
    Write-ColorOutput "4. Test the extension on LinkedIn profiles" -Color "Info"
}

function Start-ExtensionTests {
    Show-Header "Running Extension Tests"
    
    # Create test results file
    $testResults = @()
    $testStartTime = Get-Date
    
    # Test 1: File integrity
    Write-ColorOutput "Test 1: File Integrity" -Color "Info"
    $fileTests = @{
        "manifest.json" = { 
            $content = Get-Content "manifest.json" | ConvertFrom-Json
            return $content.name -eq "LinkedIn Connection Assistant"
        }
        "popup.html" = {
            $content = Get-Content "popup.html" -Raw
            return $content -match "LinkedIn Connection Assistant" -and $content -match "popup.js"
        }
        "popup.js" = {
            $content = Get-Content "popup.js" -Raw
            return $content -match "PopupManager" -and $content -match "chrome.storage"
        }
        "content.js" = {
            $content = Get-Content "content.js" -Raw
            return $content -match "LinkedInConnectionAssistant" -and $content -match "linkedin.com"
        }
        "background.js" = {
            $content = Get-Content "background.js" -Raw
            return $content -match "BackgroundManager" -and $content -match "chrome.runtime"
        }
        "styles.css" = {
            $content = Get-Content "styles.css" -Raw
            return $content -match "linkedin-assistant" -and $content -match "#0073b1"
        }
    }
    
    foreach ($file in $fileTests.Keys) {
        try {
            $result = & $fileTests[$file]
            if ($result) {
                Write-ColorOutput "  [PASS] $file" -Color "Success"
                $testResults += [PSCustomObject]@{ Test = "$file integrity"; Result = "PASS"; Time = (Get-Date) }
            } else {
                Write-ColorOutput "  [FAIL] $file" -Color "Error"
                $testResults += [PSCustomObject]@{ Test = "$file integrity"; Result = "FAIL"; Time = (Get-Date) }
            }
        } catch {
            Write-ColorOutput "  [ERROR] $file - $($_.Exception.Message)" -Color "Error"
            $testResults += [PSCustomObject]@{ Test = "$file integrity"; Result = "ERROR"; Time = (Get-Date) }
        }
    }
    
    # Test 2: CSS Syntax Check
    Write-ColorOutput "Test 2: CSS Syntax Check" -Color "Info"
    try {
        $cssContent = Get-Content "styles.css" -Raw
        $braceCount = ($cssContent.ToCharArray() | Where-Object { $_ -eq '{' }).Count
        $closeBraceCount = ($cssContent.ToCharArray() | Where-Object { $_ -eq '}' }).Count
        
        if ($braceCount -eq $closeBraceCount) {
            Write-ColorOutput "  [PASS] CSS: Balanced braces ($braceCount pairs)" -Color "Success"
            $testResults += [PSCustomObject]@{ Test = "CSS syntax"; Result = "PASS"; Time = (Get-Date) }
        } else {
            Write-ColorOutput "  [FAIL] CSS: Unbalanced braces (open: $braceCount, close: $closeBraceCount)" -Color "Error"
            $testResults += [PSCustomObject]@{ Test = "CSS syntax"; Result = "FAIL"; Time = (Get-Date) }
        }
    } catch {
        Write-ColorOutput "  [ERROR] CSS: Error checking syntax" -Color "Error"
        $testResults += [PSCustomObject]@{ Test = "CSS syntax"; Result = "ERROR"; Time = (Get-Date) }
    }
    
    # Test 3: JavaScript Basic Syntax
    Write-ColorOutput "Test 3: JavaScript Basic Syntax" -Color "Info"
    $jsFiles = @("popup.js", "content.js", "background.js")
    
    foreach ($jsFile in $jsFiles) {
        try {
            $jsContent = Get-Content $jsFile -Raw
            
            # Basic syntax checks
            $parenCount = ($jsContent.ToCharArray() | Where-Object { $_ -eq '(' }).Count
            $closeParenCount = ($jsContent.ToCharArray() | Where-Object { $_ -eq ')' }).Count
            $braceCount = ($jsContent.ToCharArray() | Where-Object { $_ -eq '{' }).Count
            $closeBraceCount = ($jsContent.ToCharArray() | Where-Object { $_ -eq '}' }).Count
            
            if ($parenCount -eq $closeParenCount -and $braceCount -eq $closeBraceCount) {
                Write-ColorOutput "  [PASS] ${jsFile}: Basic syntax OK" -Color "Success"
                $testResults += [PSCustomObject]@{ Test = "$jsFile syntax"; Result = "PASS"; Time = (Get-Date) }
            } else {
                Write-ColorOutput "  [FAIL] ${jsFile}: Potential syntax issues" -Color "Error"
                $testResults += [PSCustomObject]@{ Test = "$jsFile syntax"; Result = "FAIL"; Time = (Get-Date) }
            }
        } catch {
            Write-ColorOutput "  [ERROR] ${jsFile}: Error checking syntax" -Color "Error"
            $testResults += [PSCustomObject]@{ Test = "$jsFile syntax"; Result = "ERROR"; Time = (Get-Date) }
        }
    }
    
    # Generate test report
    $testEndTime = Get-Date
    $testDuration = $testEndTime - $testStartTime
    
    # Ensure test-results directory exists
    if (-not (Test-Path $TestResultsDir)) {
        New-Item -ItemType Directory -Path $TestResultsDir -Force | Out-Null
    }

    $reportPath = Join-Path $TestResultsDir "test-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $report = @{
        ExtensionName = $ExtensionName
        TestStartTime = $testStartTime
        TestEndTime = $testEndTime
        Duration = $testDuration.TotalSeconds
        Results = $testResults
        Summary = @{
            Total = $testResults.Count
            Passed = ($testResults | Where-Object { $_.Result -eq "PASS" }).Count
            Failed = ($testResults | Where-Object { $_.Result -eq "FAIL" }).Count
            Errors = ($testResults | Where-Object { $_.Result -eq "ERROR" }).Count
        }
    }
    
    $report | ConvertTo-Json -Depth 3 | Out-File $reportPath -Encoding UTF8
    
    Write-ColorOutput "Test Summary:" -Color "Info"
    Write-ColorOutput "  Total Tests: $($report.Summary.Total)" -Color "Info"
    Write-ColorOutput "  Passed: $($report.Summary.Passed)" -Color "Success"
    Write-ColorOutput "  Failed: $($report.Summary.Failed)" -Color "Error"
    Write-ColorOutput "  Errors: $($report.Summary.Errors)" -Color "Error"
    Write-ColorOutput "  Duration: $([math]::Round($testDuration.TotalSeconds, 2)) seconds" -Color "Info"
    Write-ColorOutput "  Report saved: $reportPath" -Color "Info"
}

function New-ExtensionPackage {
    Show-Header "Creating Extension Package"
    
    # Clean package directory
    if (Test-Path $PackageDir) {
        Remove-Item $PackageDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $PackageDir -Force | Out-Null
    
    # Get version from manifest
    $manifest = Get-Content "manifest.json" | ConvertFrom-Json
    $version = $manifest.version
    $packageName = "linkedin-connection-assistant-v$version"
    $packagePath = Join-Path $PackageDir "$packageName.zip"
    
    # Files to include in package
    $filesToPackage = @(
        "manifest.json",
        "popup.html",
        "popup.js",
        "content.js",
        "background.js",
        "styles.css",
        "README.md"
    )
    
    Write-ColorOutput "Creating package: $packageName" -Color "Info"
    
    # Create temporary directory for clean package
    $tempDir = Join-Path $PackageDir "temp"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    try {
        # Copy files to temp directory
        foreach ($file in $filesToPackage) {
            if (Test-Path $file) {
                Copy-Item $file $tempDir
                Write-ColorOutput "  [OK] Added: $file" -Color "Success"
            } else {
                Write-ColorOutput "  [WARN] Skipped: $file (not found)" -Color "Warning"
            }
        }
        
        # Create ZIP package
        if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
            Compress-Archive -Path "$tempDir\*" -DestinationPath $packagePath -Force
            Write-ColorOutput "[OK] Package created: $packagePath" -Color "Success"
            
            # Show package info
            $packageSize = (Get-Item $packagePath).Length
            Write-ColorOutput "Package size: $([math]::Round($packageSize / 1KB, 2)) KB" -Color "Info"
            
        } else {
            Write-ColorOutput "[FAIL] Compress-Archive not available. Cannot create ZIP package." -Color "Error"
        }
        
    } finally {
        # Clean up temp directory
        if (Test-Path $tempDir) {
            Remove-Item $tempDir -Recurse -Force
        }
    }
    
    Write-ColorOutput "Package ready for Chrome Web Store submission!" -Color "Success"
}

function Clear-DevelopmentFiles {
    Show-Header "Cleaning Development Files"
    
    $cleanupDirs = @($PackageDir, $TestResultsDir)
    
    foreach ($dir in $cleanupDirs) {
        if (Test-Path $dir) {
            Remove-Item $dir -Recurse -Force
            Write-ColorOutput "[OK] Removed: $dir" -Color "Success"
        }
    }
    
    # Clean up any temporary files
    $tempFiles = Get-ChildItem -Path $ExtensionDir -Filter "*.tmp" -ErrorAction SilentlyContinue
    foreach ($file in $tempFiles) {
        Remove-Item $file.FullName -Force
        Write-ColorOutput "[OK] Removed temp file: $($file.Name)" -Color "Success"
    }
    
    Write-ColorOutput "Cleanup complete!" -Color "Success"
}

function Show-Usage {
    Write-ColorOutput "LinkedIn Connection Assistant - Development Script" -Color "Header"
    Write-ColorOutput ""
    Write-ColorOutput "Usage: .\setup-ascii.ps1 [-Action <action>]" -Color "Info"
    Write-ColorOutput ""
    Write-ColorOutput "Actions:" -Color "Info"
    Write-ColorOutput "  setup   - Setup development environment (default)" -Color "Info"
    Write-ColorOutput "  test    - Run extension tests" -Color "Info"
    Write-ColorOutput "  package - Create extension package for distribution" -Color "Info"
    Write-ColorOutput "  clean   - Clean development files" -Color "Info"
    Write-ColorOutput ""
    Write-ColorOutput "Examples:" -Color "Info"
    Write-ColorOutput "  .\setup-ascii.ps1                # Setup development environment" -Color "Info"
    Write-ColorOutput "  .\setup-ascii.ps1 -Action test   # Run tests" -Color "Info"
    Write-ColorOutput "  .\setup-ascii.ps1 -Action package # Create package" -Color "Info"
}

# Main execution
try {
    switch ($Action.ToLower()) {
        "setup" {
            Test-Prerequisites
            Start-DevelopmentSetup
        }
        "test" {
            Test-Prerequisites
            Start-ExtensionTests
        }
        "package" {
            Test-Prerequisites
            Start-ExtensionTests
            New-ExtensionPackage
        }
        "clean" {
            Clear-DevelopmentFiles
        }
        default {
            Show-Usage
        }
    }
    
    Write-ColorOutput ""
    Write-ColorOutput "Script completed successfully!" -Color "Success"
    
} catch {
    Write-ColorOutput ""
    Write-ColorOutput "Script failed: $($_.Exception.Message)" -Color "Error"
    exit 1
} 