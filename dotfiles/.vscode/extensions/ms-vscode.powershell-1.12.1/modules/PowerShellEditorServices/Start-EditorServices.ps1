<#
.SYNOPSIS
    Starts the language and debug services from the PowerShellEditorServices module.
.DESCRIPTION
    PowerShell Editor Services Bootstrapper Script
    ----------------------------------------------
    This script contains startup logic for the PowerShell Editor Services
    module when launched by an editor.  It handles the following tasks:

    - Verifying the existence of dependencies like PowerShellGet
    - Verifying that the expected version of the PowerShellEditorServices module is installed
    - Installing the PowerShellEditorServices module if confirmed by the user
    - Creating named pipes for the language and debug services to use (if using named pipes)
    - Starting the language and debug services from the PowerShellEditorServices module
.INPUTS
    None
.OUTPUTS
    None
.NOTES
    If editor integration authors make modifications to this script, please
    consider contributing changes back to the canonical version of this script
    at the PowerShell Editor Services GitHub repository:
    https://github.com/PowerShell/PowerShellEditorServices/blob/master/module/PowerShellEditorServices/Start-EditorServices.ps1'
#>
[CmdletBinding(DefaultParameterSetName="NamedPipe")]
param(
    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $HostName,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $HostProfileId,

    [Parameter(Mandatory=$true)]
    [ValidateNotNullOrEmpty()]
    [string]
    $HostVersion,

    [ValidateNotNullOrEmpty()]
    [string]
    $BundledModulesPath,

    [ValidateNotNullOrEmpty()]
    $LogPath,

    [ValidateSet("Diagnostic", "Verbose", "Normal", "Warning", "Error")]
    $LogLevel,

	[Parameter(Mandatory=$true)]
	[ValidateNotNullOrEmpty()]
	[string]
	$SessionDetailsPath,

    [switch]
    $EnableConsoleRepl,

    [switch]
    $DebugServiceOnly,

    [string[]]
    $AdditionalModules,

    [string[]]
    $FeatureFlags,

    [switch]
    $WaitForDebugger,

    [switch]
    $ConfirmInstall,

    [Parameter(ParameterSetName="Stdio", Mandatory=$true)]
    [switch]
    $Stdio,

    [Parameter(ParameterSetName="NamedPipe")]
    [string]
    $LanguageServicePipeName = $null,

    [Parameter(ParameterSetName="NamedPipe")]
    [string]
    $DebugServicePipeName = $null,

    [Parameter(ParameterSetName="NamedPipeSimplex")]
    [switch]
    $SplitInOutPipes,

    [Parameter(ParameterSetName="NamedPipeSimplex")]
    [string]
    $LanguageServiceInPipeName,

    [Parameter(ParameterSetName="NamedPipeSimplex")]
    [string]
    $LanguageServiceOutPipeName,

    [Parameter(ParameterSetName="NamedPipeSimplex")]
    [string]
    $DebugServiceInPipeName = $null,

    [Parameter(ParameterSetName="NamedPipeSimplex")]
    [string]
    $DebugServiceOutPipeName = $null
)

$DEFAULT_USER_MODE = "600"

if ($LogLevel -eq "Diagnostic") {
    if (!$Stdio.IsPresent) {
        $VerbosePreference = 'Continue'
    }
    $scriptName = [System.IO.Path]::GetFileNameWithoutExtension($MyInvocation.MyCommand.Name)
    $logFileName = [System.IO.Path]::GetFileName($LogPath)
    Start-Transcript (Join-Path (Split-Path $LogPath -Parent) "$scriptName-$logFileName") -Force | Out-Null
}

function LogSection([string]$msg) {
    Write-Verbose "`n#-- $msg $('-' * ([Math]::Max(0, 73 - $msg.Length)))"
}

function Log([string[]]$msg) {
    $msg | Write-Verbose
}

function ExitWithError($errorString) {
    Write-Host -ForegroundColor Red "`n`n$errorString"

    # Sleep for a while to make sure the user has time to see and copy the
    # error message
    Start-Sleep -Seconds 300

    exit 1;
}

function WriteSessionFile($sessionInfo) {
    $sessionInfoJson = Microsoft.PowerShell.Utility\ConvertTo-Json -InputObject $sessionInfo -Compress
    Log "Writing session file with contents:"
    Log $sessionInfoJson
    $sessionInfoJson | Microsoft.PowerShell.Management\Set-Content -Force -Path "$SessionDetailsPath" -ErrorAction Stop
}

# Are we running in PowerShell 2 or earlier?
if ($PSVersionTable.PSVersion.Major -le 2) {
    # No ConvertTo-Json on PSv2 and below, so write out the JSON manually
    "{`"status`": `"failed`", `"reason`": `"unsupported`", `"powerShellVersion`": `"$($PSVersionTable.PSVersion.ToString())`"}" |
        Microsoft.PowerShell.Management\Set-Content -Force -Path "$SessionDetailsPath" -ErrorAction Stop

    ExitWithError "Unsupported PowerShell version $($PSVersionTable.PSVersion), language features are disabled."
}


if ($host.Runspace.LanguageMode -eq 'ConstrainedLanguage') {
    WriteSessionFile @{
        "status" = "failed"
        "reason" = "languageMode"
        "detail" = $host.Runspace.LanguageMode.ToString()
    }

    ExitWithError "PowerShell is configured with an unsupported LanguageMode (ConstrainedLanguage), language features are disabled."
}

# net451 and lower are not supported, only net452 and up
if ($PSVersionTable.PSVersion.Major -le 5) {
    $net452Version = 379893
    $dotnetVersion = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full\").Release
    if ($dotnetVersion -lt $net452Version) {
        Write-SessionFile @{
            status = failed
            reason = "netversion"
            detail = "$netVersion"
        }

        ExitWithError "Your .NET version is too low. Upgrade to net452 or higher to run the PowerShell extension."
    }
}

# If PSReadline is present in the session, remove it so that runspace
# management is easier
if ((Microsoft.PowerShell.Core\Get-Module PSReadline).Count -gt 0) {
    LogSection "Removing PSReadLine module"
    Microsoft.PowerShell.Core\Remove-Module PSReadline -ErrorAction SilentlyContinue
}

# This variable will be assigned later to contain information about
# what happened while attempting to launch the PowerShell Editor
# Services host
$resultDetails = $null;

function Test-ModuleAvailable($ModuleName, $ModuleVersion) {
    Log "Testing module availability $ModuleName $ModuleVersion"

    $modules = Microsoft.PowerShell.Core\Get-Module -ListAvailable $moduleName
    if ($null -ne $modules) {
        if ($null -ne $ModuleVersion) {
            foreach ($module in $modules) {
                if ($module.Version.Equals($moduleVersion)) {
                    Log "$ModuleName $ModuleVersion found"
                    return $true;
                }
            }
        }
        else {
            Log "$ModuleName $ModuleVersion found"
            return $true;
        }
    }

    Log "$ModuleName $ModuleVersion NOT found"
    return $false;
}

function New-NamedPipeName {
    # We try 10 times to find a valid pipe name
    for ($i = 0; $i -lt 10; $i++) {
        $PipeName = "PSES_$([System.IO.Path]::GetRandomFileName())"

        if ((Test-NamedPipeName -PipeName $PipeName)) {
            return $PipeName
        }
    }

    ExitWithError "Could not find valid a pipe name."
}

function Get-NamedPipePath {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $PipeName
    )

    if (($PSVersionTable.PSVersion.Major -le 5) -or $IsWindows) {
        return "\\.\pipe\$PipeName";
    }
    else {
        # Windows uses NamedPipes where non-Windows platforms use Unix Domain Sockets.
        # the Unix Domain Sockets live in the tmp directory and are prefixed with "CoreFxPipe_"
        return (Join-Path -Path ([System.IO.Path]::GetTempPath()) -ChildPath "CoreFxPipe_$PipeName")
    }
}

# Returns True if it's a valid pipe name
# A valid pipe name is a file that does not exist either
# in the temp directory (macOS & Linux) or in the pipe directory (Windows)
function Test-NamedPipeName {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $PipeName
    )

    $path = Get-NamedPipePath -PipeName $PipeName
    return !(Test-Path $path)
}

function Set-NamedPipeMode {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateNotNullOrEmpty()]
        [string]
        $PipeFile
    )

    if (($PSVersionTable.PSVersion.Major -le 5) -or $IsWindows) {
        return
    }

    chmod $DEFAULT_USER_MODE $PipeFile

    if ($IsLinux) {
        $mode = /usr/bin/stat -c "%a" $PipeFile
    }
    elseif ($IsMacOS) {
        $mode = /usr/bin/stat -f "%A" $PipeFile
    }

    if ($mode -ne $DEFAULT_USER_MODE) {
        ExitWithError "Permissions to the pipe file were not set properly. Expected: $DEFAULT_USER_MODE Actual: $mode for file: $PipeFile"
    }
}

LogSection "Console Encoding"
Log $OutputEncoding

function Get-ValidatedNamedPipeName {
    param(
        [string]
        $PipeName
    )

    # If no PipeName is passed in, then we create one that's guaranteed to be valid
    if (!$PipeName) {
        $PipeName = New-NamedPipeName
    }
    elseif (!(Test-NamedPipeName -PipeName $PipeName)) {
        ExitWithError "Pipe name supplied is already in use: $PipeName"
    }

    return $PipeName
}

function Set-PipeFileResult {
    param (
        [Hashtable]
        $ResultTable,

        [string]
        $PipeNameKey,

        [string]
        $PipeNameValue
    )

    $ResultTable[$PipeNameKey] = Get-NamedPipePath -PipeName $PipeNameValue
    if (($PSVersionTable.PSVersion.Major -ge 6) -and ($IsLinux -or $IsMacOS)) {
        Set-NamedPipeMode -PipeFile $ResultTable[$PipeNameKey]
    }
}

# Add BundledModulesPath to $env:PSModulePath
if ($BundledModulesPath) {
    $env:PSModulePath = $env:PSModulePath.TrimEnd([System.IO.Path]::PathSeparator) + [System.IO.Path]::PathSeparator + $BundledModulesPath
    LogSection "Updated PSModulePath to:"
    Log ($env:PSModulePath -split [System.IO.Path]::PathSeparator)
}

LogSection "Check required modules available"
# Check if PowerShellGet module is available
if ((Test-ModuleAvailable "PowerShellGet") -eq $false) {
    Log "Failed to find PowerShellGet module"
    # TODO: WRITE ERROR
}

try {
    LogSection "Start up PowerShellEditorServices"
    Log "Importing PowerShellEditorServices"

    Microsoft.PowerShell.Core\Import-Module PowerShellEditorServices -ErrorAction Stop

    if ($EnableConsoleRepl) {
        Write-Host "PowerShell Integrated Console`n"
    }

    $resultDetails = @{
        "status" = "not started";
        "languageServiceTransport" = $PSCmdlet.ParameterSetName;
        "debugServiceTransport" = $PSCmdlet.ParameterSetName;
    };

    # Create the Editor Services host
    Log "Invoking Start-EditorServicesHost"
    # There could be only one service on Stdio channel
    # Locate available port numbers for services
    switch ($PSCmdlet.ParameterSetName) {
        "Stdio" {
            $editorServicesHost = Start-EditorServicesHost `
                                        -HostName $HostName `
                                        -HostProfileId $HostProfileId `
                                        -HostVersion $HostVersion `
                                        -LogPath $LogPath `
                                        -LogLevel $LogLevel `
                                        -AdditionalModules $AdditionalModules `
                                        -Stdio `
                                        -BundledModulesPath $BundledModulesPath `
                                        -EnableConsoleRepl:$EnableConsoleRepl.IsPresent `
                                        -DebugServiceOnly:$DebugServiceOnly.IsPresent `
                                        -WaitForDebugger:$WaitForDebugger.IsPresent
            break
        }

        "NamedPipeSimplex" {
            $LanguageServiceInPipeName = Get-ValidatedNamedPipeName $LanguageServiceInPipeName
            $LanguageServiceOutPipeName = Get-ValidatedNamedPipeName $LanguageServiceOutPipeName
            $DebugServiceInPipeName = Get-ValidatedNamedPipeName $DebugServiceInPipeName
            $DebugServiceOutPipeName = Get-ValidatedNamedPipeName $DebugServiceOutPipeName

            $editorServicesHost = Start-EditorServicesHost `
                                        -HostName $HostName `
                                        -HostProfileId $HostProfileId `
                                        -HostVersion $HostVersion `
                                        -LogPath $LogPath `
                                        -LogLevel $LogLevel `
                                        -AdditionalModules $AdditionalModules `
                                        -LanguageServiceInNamedPipe $LanguageServiceInPipeName `
                                        -LanguageServiceOutNamedPipe $LanguageServiceOutPipeName `
                                        -DebugServiceInNamedPipe $DebugServiceInPipeName `
                                        -DebugServiceOutNamedPipe $DebugServiceOutPipeName `
                                        -BundledModulesPath $BundledModulesPath `
                                        -EnableConsoleRepl:$EnableConsoleRepl.IsPresent `
                                        -DebugServiceOnly:$DebugServiceOnly.IsPresent `
                                        -WaitForDebugger:$WaitForDebugger.IsPresent

            Set-PipeFileResult $resultDetails "languageServiceReadPipeName" $LanguageServiceInPipeName
            Set-PipeFileResult $resultDetails "languageServiceWritePipeName" $LanguageServiceOutPipeName
            Set-PipeFileResult $resultDetails "debugServiceReadPipeName" $DebugServiceInPipeName
            Set-PipeFileResult $resultDetails "debugServiceWritePipeName" $DebugServiceOutPipeName
            break
        }

        Default {
            $LanguageServicePipeName = Get-ValidatedNamedPipeName $LanguageServicePipeName
            $DebugServicePipeName = Get-ValidatedNamedPipeName $DebugServicePipeName

            $editorServicesHost = Start-EditorServicesHost `
                                        -HostName $HostName `
                                        -HostProfileId $HostProfileId `
                                        -HostVersion $HostVersion `
                                        -LogPath $LogPath `
                                        -LogLevel $LogLevel `
                                        -AdditionalModules $AdditionalModules `
                                        -LanguageServiceNamedPipe $LanguageServicePipeName `
                                        -DebugServiceNamedPipe $DebugServicePipeName `
                                        -BundledModulesPath $BundledModulesPath `
                                        -EnableConsoleRepl:$EnableConsoleRepl.IsPresent `
                                        -DebugServiceOnly:$DebugServiceOnly.IsPresent `
                                        -WaitForDebugger:$WaitForDebugger.IsPresent

            Set-PipeFileResult $resultDetails "languageServicePipeName" $LanguageServicePipeName
            Set-PipeFileResult $resultDetails "debugServicePipeName" $DebugServicePipeName
            break
        }
    }

    # TODO: Verify that the service is started
    Log "Start-EditorServicesHost returned $editorServicesHost"

    $resultDetails["status"] = "started"

    # Notify the client that the services have started
    WriteSessionFile $resultDetails

    Log "Wrote out session file"
}
catch [System.Exception] {
    $e = $_.Exception;
    $errorString = ""

    Log "ERRORS caught starting up EditorServicesHost"

    while ($null -ne $e) {
        $errorString = $errorString + ($e.Message + "`r`n" + $e.StackTrace + "`r`n")
        $e = $e.InnerException;
        Log $errorString
    }

    ExitWithError ("An error occurred while starting PowerShell Editor Services:`r`n`r`n" + $errorString)
}

try {
    # Wait for the host to complete execution before exiting
    LogSection "Waiting for EditorServicesHost to complete execution"
    $editorServicesHost.WaitForCompletion()
    Log "EditorServicesHost has completed execution"
}
catch [System.Exception] {
    $e = $_.Exception;
    $errorString = ""

    Log "ERRORS caught while waiting for EditorServicesHost to complete execution"

    while ($null -ne $e) {
        $errorString = $errorString + ($e.Message + "`r`n" + $e.StackTrace + "`r`n")
        $e = $e.InnerException;
        Log $errorString
    }
}

# SIG # Begin signature block
# MIIkWwYJKoZIhvcNAQcCoIIkTDCCJEgCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCA34bwyoOFOMkbI
# lQSJQSB3HQCTUG1xakwe2C4Am9Q706CCDYEwggX/MIID56ADAgECAhMzAAABA14l
# HJkfox64AAAAAAEDMA0GCSqGSIb3DQEBCwUAMH4xCzAJBgNVBAYTAlVTMRMwEQYD
# VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
# b3NvZnQgQ29ycG9yYXRpb24xKDAmBgNVBAMTH01pY3Jvc29mdCBDb2RlIFNpZ25p
# bmcgUENBIDIwMTEwHhcNMTgwNzEyMjAwODQ4WhcNMTkwNzI2MjAwODQ4WjB0MQsw
# CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
# ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMR4wHAYDVQQDExVNaWNy
# b3NvZnQgQ29ycG9yYXRpb24wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIB
# AQDRlHY25oarNv5p+UZ8i4hQy5Bwf7BVqSQdfjnnBZ8PrHuXss5zCvvUmyRcFrU5
# 3Rt+M2wR/Dsm85iqXVNrqsPsE7jS789Xf8xly69NLjKxVitONAeJ/mkhvT5E+94S
# nYW/fHaGfXKxdpth5opkTEbOttU6jHeTd2chnLZaBl5HhvU80QnKDT3NsumhUHjR
# hIjiATwi/K+WCMxdmcDt66VamJL1yEBOanOv3uN0etNfRpe84mcod5mswQ4xFo8A
# DwH+S15UD8rEZT8K46NG2/YsAzoZvmgFFpzmfzS/p4eNZTkmyWPU78XdvSX+/Sj0
# NIZ5rCrVXzCRO+QUauuxygQjAgMBAAGjggF+MIIBejAfBgNVHSUEGDAWBgorBgEE
# AYI3TAgBBggrBgEFBQcDAzAdBgNVHQ4EFgQUR77Ay+GmP/1l1jjyA123r3f3QP8w
# UAYDVR0RBEkwR6RFMEMxKTAnBgNVBAsTIE1pY3Jvc29mdCBPcGVyYXRpb25zIFB1
# ZXJ0byBSaWNvMRYwFAYDVQQFEw0yMzAwMTIrNDM3OTY1MB8GA1UdIwQYMBaAFEhu
# ZOVQBdOCqhc3NyK1bajKdQKVMFQGA1UdHwRNMEswSaBHoEWGQ2h0dHA6Ly93d3cu
# bWljcm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01pY0NvZFNpZ1BDQTIwMTFfMjAxMS0w
# Ny0wOC5jcmwwYQYIKwYBBQUHAQEEVTBTMFEGCCsGAQUFBzAChkVodHRwOi8vd3d3
# Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL01pY0NvZFNpZ1BDQTIwMTFfMjAx
# MS0wNy0wOC5jcnQwDAYDVR0TAQH/BAIwADANBgkqhkiG9w0BAQsFAAOCAgEAn/XJ
# Uw0/DSbsokTYDdGfY5YGSz8eXMUzo6TDbK8fwAG662XsnjMQD6esW9S9kGEX5zHn
# wya0rPUn00iThoj+EjWRZCLRay07qCwVlCnSN5bmNf8MzsgGFhaeJLHiOfluDnjY
# DBu2KWAndjQkm925l3XLATutghIWIoCJFYS7mFAgsBcmhkmvzn1FFUM0ls+BXBgs
# 1JPyZ6vic8g9o838Mh5gHOmwGzD7LLsHLpaEk0UoVFzNlv2g24HYtjDKQ7HzSMCy
# RhxdXnYqWJ/U7vL0+khMtWGLsIxB6aq4nZD0/2pCD7k+6Q7slPyNgLt44yOneFuy
# bR/5WcF9ttE5yXnggxxgCto9sNHtNr9FB+kbNm7lPTsFA6fUpyUSj+Z2oxOzRVpD
# MYLa2ISuubAfdfX2HX1RETcn6LU1hHH3V6qu+olxyZjSnlpkdr6Mw30VapHxFPTy
# 2TUxuNty+rR1yIibar+YRcdmstf/zpKQdeTr5obSyBvbJ8BblW9Jb1hdaSreU0v4
# 6Mp79mwV+QMZDxGFqk+av6pX3WDG9XEg9FGomsrp0es0Rz11+iLsVT9qGTlrEOla
# P470I3gwsvKmOMs1jaqYWSRAuDpnpAdfoP7YO0kT+wzh7Qttg1DO8H8+4NkI6Iwh
# SkHC3uuOW+4Dwx1ubuZUNWZncnwa6lL2IsRyP64wggd6MIIFYqADAgECAgphDpDS
# AAAAAAADMA0GCSqGSIb3DQEBCwUAMIGIMQswCQYDVQQGEwJVUzETMBEGA1UECBMK
# V2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
# IENvcnBvcmF0aW9uMTIwMAYDVQQDEylNaWNyb3NvZnQgUm9vdCBDZXJ0aWZpY2F0
# ZSBBdXRob3JpdHkgMjAxMTAeFw0xMTA3MDgyMDU5MDlaFw0yNjA3MDgyMTA5MDla
# MH4xCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdS
# ZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKDAmBgNVBAMT
# H01pY3Jvc29mdCBDb2RlIFNpZ25pbmcgUENBIDIwMTEwggIiMA0GCSqGSIb3DQEB
# AQUAA4ICDwAwggIKAoICAQCr8PpyEBwurdhuqoIQTTS68rZYIZ9CGypr6VpQqrgG
# OBoESbp/wwwe3TdrxhLYC/A4wpkGsMg51QEUMULTiQ15ZId+lGAkbK+eSZzpaF7S
# 35tTsgosw6/ZqSuuegmv15ZZymAaBelmdugyUiYSL+erCFDPs0S3XdjELgN1q2jz
# y23zOlyhFvRGuuA4ZKxuZDV4pqBjDy3TQJP4494HDdVceaVJKecNvqATd76UPe/7
# 4ytaEB9NViiienLgEjq3SV7Y7e1DkYPZe7J7hhvZPrGMXeiJT4Qa8qEvWeSQOy2u
# M1jFtz7+MtOzAz2xsq+SOH7SnYAs9U5WkSE1JcM5bmR/U7qcD60ZI4TL9LoDho33
# X/DQUr+MlIe8wCF0JV8YKLbMJyg4JZg5SjbPfLGSrhwjp6lm7GEfauEoSZ1fiOIl
# XdMhSz5SxLVXPyQD8NF6Wy/VI+NwXQ9RRnez+ADhvKwCgl/bwBWzvRvUVUvnOaEP
# 6SNJvBi4RHxF5MHDcnrgcuck379GmcXvwhxX24ON7E1JMKerjt/sW5+v/N2wZuLB
# l4F77dbtS+dJKacTKKanfWeA5opieF+yL4TXV5xcv3coKPHtbcMojyyPQDdPweGF
# RInECUzF1KVDL3SV9274eCBYLBNdYJWaPk8zhNqwiBfenk70lrC8RqBsmNLg1oiM
# CwIDAQABo4IB7TCCAekwEAYJKwYBBAGCNxUBBAMCAQAwHQYDVR0OBBYEFEhuZOVQ
# BdOCqhc3NyK1bajKdQKVMBkGCSsGAQQBgjcUAgQMHgoAUwB1AGIAQwBBMAsGA1Ud
# DwQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB8GA1UdIwQYMBaAFHItOgIxkEO5FAVO
# 4eqnxzHRI4k0MFoGA1UdHwRTMFEwT6BNoEuGSWh0dHA6Ly9jcmwubWljcm9zb2Z0
# LmNvbS9wa2kvY3JsL3Byb2R1Y3RzL01pY1Jvb0NlckF1dDIwMTFfMjAxMV8wM18y
# Mi5jcmwwXgYIKwYBBQUHAQEEUjBQME4GCCsGAQUFBzAChkJodHRwOi8vd3d3Lm1p
# Y3Jvc29mdC5jb20vcGtpL2NlcnRzL01pY1Jvb0NlckF1dDIwMTFfMjAxMV8wM18y
# Mi5jcnQwgZ8GA1UdIASBlzCBlDCBkQYJKwYBBAGCNy4DMIGDMD8GCCsGAQUFBwIB
# FjNodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2RvY3MvcHJpbWFyeWNw
# cy5odG0wQAYIKwYBBQUHAgIwNB4yIB0ATABlAGcAYQBsAF8AcABvAGwAaQBjAHkA
# XwBzAHQAYQB0AGUAbQBlAG4AdAAuIB0wDQYJKoZIhvcNAQELBQADggIBAGfyhqWY
# 4FR5Gi7T2HRnIpsLlhHhY5KZQpZ90nkMkMFlXy4sPvjDctFtg/6+P+gKyju/R6mj
# 82nbY78iNaWXXWWEkH2LRlBV2AySfNIaSxzzPEKLUtCw/WvjPgcuKZvmPRul1LUd
# d5Q54ulkyUQ9eHoj8xN9ppB0g430yyYCRirCihC7pKkFDJvtaPpoLpWgKj8qa1hJ
# Yx8JaW5amJbkg/TAj/NGK978O9C9Ne9uJa7lryft0N3zDq+ZKJeYTQ49C/IIidYf
# wzIY4vDFLc5bnrRJOQrGCsLGra7lstnbFYhRRVg4MnEnGn+x9Cf43iw6IGmYslmJ
# aG5vp7d0w0AFBqYBKig+gj8TTWYLwLNN9eGPfxxvFX1Fp3blQCplo8NdUmKGwx1j
# NpeG39rz+PIWoZon4c2ll9DuXWNB41sHnIc+BncG0QaxdR8UvmFhtfDcxhsEvt9B
# xw4o7t5lL+yX9qFcltgA1qFGvVnzl6UJS0gQmYAf0AApxbGbpT9Fdx41xtKiop96
# eiL6SJUfq/tHI4D1nvi/a7dLl+LrdXga7Oo3mXkYS//WsyNodeav+vyL6wuA6mk7
# r/ww7QRMjt/fdW1jkT3RnVZOT7+AVyKheBEyIXrvQQqxP/uozKRdwaGIm1dxVk5I
# RcBCyZt2WwqASGv9eZ/BvW1taslScxMNelDNMYIWMDCCFiwCAQEwgZUwfjELMAkG
# A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
# HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEoMCYGA1UEAxMfTWljcm9z
# b2Z0IENvZGUgU2lnbmluZyBQQ0EgMjAxMQITMwAAAQNeJRyZH6MeuAAAAAABAzAN
# BglghkgBZQMEAgEFAKCBrjAZBgkqhkiG9w0BCQMxDAYKKwYBBAGCNwIBBDAcBgor
# BgEEAYI3AgELMQ4wDAYKKwYBBAGCNwIBFTAvBgkqhkiG9w0BCQQxIgQgJD+EMtMy
# P88dFb12lI7aPG1+UmUVyPaXNprOZjWjgDQwQgYKKwYBBAGCNwIBDDE0MDKgFIAS
# AE0AaQBjAHIAbwBzAG8AZgB0oRqAGGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbTAN
# BgkqhkiG9w0BAQEFAASCAQCA1V3i2hd4b4K6LPy7d0571O+YvEO/lEaH4iRT9cKC
# IJc+gz+64jAprsOsywtS6XVY2ts5sCdMY/daOPNgT488cxCwpErDTGAj3cRIzI+j
# J5x7B0Y+WMoj/wqYQkqyhDnC0pxymY+N6gCYqSid/akOYo1Hp6j1axIacDb6RD+d
# uW1Op/q77kfmU1NgPVhBjZJWy0NVAcAzzN44vSrmrJVSgCGakTp7D+MKnNxmM9r8
# YVrIaRWSYWhLP+ZHF+zUlFn6FvZJ08orC37XtSd5b4mxdq9R1ewEVFNOufzc8N6I
# NvdVV3SI0GRaXpdFNPRrLE60abzD1hjlvGjDZSXFYNZaoYITujCCE7YGCisGAQQB
# gjcDAwExghOmMIITogYJKoZIhvcNAQcCoIITkzCCE48CAQMxDzANBglghkgBZQME
# AgEFADCCAVgGCyqGSIb3DQEJEAEEoIIBRwSCAUMwggE/AgEBBgorBgEEAYRZCgMB
# MDEwDQYJYIZIAWUDBAIBBQAEIPHLoId8iC+JChlIH2lHJ4bj7BVxVGAfmxH9cN+i
# GhdVAgZck+rVBvUYEzIwMTkwNDExMTkyOTUwLjA4NVowBwIBAYACAfSggdSkgdEw
# gc4xCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdS
# ZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKTAnBgNVBAsT
# IE1pY3Jvc29mdCBPcGVyYXRpb25zIFB1ZXJ0byBSaWNvMSYwJAYDVQQLEx1UaGFs
# ZXMgVFNTIEVTTjpCMUI3LUY2N0YtRkVDMjElMCMGA1UEAxMcTWljcm9zb2Z0IFRp
# bWUtU3RhbXAgU2VydmljZaCCDyIwggT1MIID3aADAgECAhMzAAAA0rjjWm3EWxp3
# AAAAAADSMA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpX
# YXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
# Q29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
# MDEwMB4XDTE4MDgyMzIwMjYzNFoXDTE5MTEyMzIwMjYzNFowgc4xCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKTAnBgNVBAsTIE1pY3Jvc29mdCBP
# cGVyYXRpb25zIFB1ZXJ0byBSaWNvMSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVTTjpC
# MUI3LUY2N0YtRkVDMjElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
# dmljZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL6qlCgdibSaobrq
# BKjOOMdrBs+/2QwgzuuPOfmdCTBQuNs7pWysQ39PEGqEpHRY0iGUGYNgpnzPnlG2
# MUmMiGaxnOkvW7/F9dOkM2YsCVZGakzO4filhUPoBJKcScTugOG5o43C3Vtl+zbi
# ux2lsjTFk0w3jFIf9FUD15+sskWZ0cOfhHe2BQfWaTpJj0s3aS4STsWm3S2VVhbX
# 6lZmtjqod7o8Wx8PpCVpGAygKTQMNpNgVKqV27U3DYYhhmhidBLviqzgfA30tUDO
# z9bXMrg29Ma0pvFaflIAVnWoNAZVcYqrGXd7yla4I6s7MwqwcisN00RKlXVnMr6S
# lbo4l0UCAwEAAaOCARswggEXMB0GA1UdDgQWBBTsrDhxdfqXySP5UnJlSeA9onfg
# zjAfBgNVHSMEGDAWgBTVYzpcijGQ80N7fEYbxTNoWoVtVTBWBgNVHR8ETzBNMEug
# SaBHhkVodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpL2NybC9wcm9kdWN0cy9N
# aWNUaW1TdGFQQ0FfMjAxMC0wNy0wMS5jcmwwWgYIKwYBBQUHAQEETjBMMEoGCCsG
# AQUFBzAChj5odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpL2NlcnRzL01pY1Rp
# bVN0YVBDQV8yMDEwLTA3LTAxLmNydDAMBgNVHRMBAf8EAjAAMBMGA1UdJQQMMAoG
# CCsGAQUFBwMIMA0GCSqGSIb3DQEBCwUAA4IBAQBGz0MpcRwOvTZ3QXq9FWewgAJy
# KiaSFpgoufls+WX4AyPQmD/LnB+ZcJR5LQnoHvdWeQizH9lW8SnbiStsnH1mVPIc
# 45Nh7PvKHLjdrke3Ky4Ht5VicKAZu18vdL3xU42eUOkMG4F6nL5nJByDTTp51vxO
# T/W/WS12PZZmcwNs6nZKrTT/TmG0QXNkZ0KL5kpF/CR7/TtO8PVQ9ciCOl/+2tnp
# Hpwj8U3XsvLaKAck9RzpoWHQ4dF3zeRKWXA7qW6pexvFX6nmJ/KFJsftRAVwZ/Z5
# mC+LOIcJlln4ZTEAKEW+HPfyjl+BS5yIl3dqhnVFukt5QLsWlKNUQKT5fNn7MIIG
# cTCCBFmgAwIBAgIKYQmBKgAAAAAAAjANBgkqhkiG9w0BAQsFADCBiDELMAkGA1UE
# BhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
# BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEyMDAGA1UEAxMpTWljcm9zb2Z0
# IFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5IDIwMTAwHhcNMTAwNzAxMjEzNjU1
# WhcNMjUwNzAxMjE0NjU1WjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
# Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
# cmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDCC
# ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKkdDbx3EYo6IOz8E5f1+n9p
# lGt0VBDVpQoAgoX77XxoSyxfxcPlYcJ2tz5mK1vwFVMnBDEfQRsalR3OCROOfGEw
# WbEwRA/xYIiEVEMM1024OAizQt2TrNZzMFcmgqNFDdDq9UeBzb8kYDJYYEbyWEeG
# MoQedGFnkV+BVLHPk0ySwcSmXdFhE24oxhr5hoC732H8RsEnHSRnEnIaIYqvS2SJ
# UGKxXf13Hz3wV3WsvYpCTUBR0Q+cBj5nf/VmwAOWRH7v0Ev9buWayrGo8noqCjHw
# 2k4GkbaICDXoeByw6ZnNPOcvRLqn9NxkvaQBwSAJk3jN/LzAyURdXhacAQVPIk0C
# AwEAAaOCAeYwggHiMBAGCSsGAQQBgjcVAQQDAgEAMB0GA1UdDgQWBBTVYzpcijGQ
# 80N7fEYbxTNoWoVtVTAZBgkrBgEEAYI3FAIEDB4KAFMAdQBiAEMAQTALBgNVHQ8E
# BAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBTV9lbLj+iiXGJo0T2U
# kFvXzpoYxDBWBgNVHR8ETzBNMEugSaBHhkVodHRwOi8vY3JsLm1pY3Jvc29mdC5j
# b20vcGtpL2NybC9wcm9kdWN0cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0yMy5jcmww
# WgYIKwYBBQUHAQEETjBMMEoGCCsGAQUFBzAChj5odHRwOi8vd3d3Lm1pY3Jvc29m
# dC5jb20vcGtpL2NlcnRzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNydDCBoAYD
# VR0gAQH/BIGVMIGSMIGPBgkrBgEEAYI3LgMwgYEwPQYIKwYBBQUHAgEWMWh0dHA6
# Ly93d3cubWljcm9zb2Z0LmNvbS9QS0kvZG9jcy9DUFMvZGVmYXVsdC5odG0wQAYI
# KwYBBQUHAgIwNB4yIB0ATABlAGcAYQBsAF8AUABvAGwAaQBjAHkAXwBTAHQAYQB0
# AGUAbQBlAG4AdAAuIB0wDQYJKoZIhvcNAQELBQADggIBAAfmiFEN4sbgmD+BcQM9
# naOhIW+z66bM9TG+zwXiqf76V20ZMLPCxWbJat/15/B4vceoniXj+bzta1RXCCtR
# gkQS+7lTjMz0YBKKdsxAQEGb3FwX/1z5Xhc1mCRWS3TvQhDIr79/xn/yN31aPxzy
# mXlKkVIArzgPF/UveYFl2am1a+THzvbKegBvSzBEJCI8z+0DpZaPWSm8tv0E4XCf
# Mkon/VWvL/625Y4zu2JfmttXQOnxzplmkIz/amJ/3cVKC5Em4jnsGUpxY517IW3D
# nKOiPPp/fZZqkHimbdLhnPkd/DjYlPTGpQqWhqS9nhquBEKDuLWAmyI4ILUl5WTs
# 9/S/fmNZJQ96LjlXdqJxqgaKD4kWumGnEcua2A5HmoDF0M2n0O99g/DhO3EJ3110
# mCIIYdqwUB5vvfHhAN/nMQekkzr3ZUd46PioSKv33nJ+YWtvd6mBy6cJrDm77MbL
# 2IK0cs0d9LiFAR6A+xuJKlQ5slvayA1VmXqHczsI5pgt6o3gMy4SKfXAL1QnIffI
# rE7aKLixqduWsqdCosnPGUFN4Ib5KpqjEWYw07t0MkvfY3v1mYovG8chr1m1rtxE
# PJdQcdeh0sVV42neV8HR3jDA/czmTfsNv11P6Z0eGTgvvM9YBS7vDaBQNdrvCScc
# 1bN+NR4Iuto229Nfj950iEkSoYIDsDCCApgCAQEwgf6hgdSkgdEwgc4xCzAJBgNV
# BAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
# HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xKTAnBgNVBAsTIE1pY3Jvc29m
# dCBPcGVyYXRpb25zIFB1ZXJ0byBSaWNvMSYwJAYDVQQLEx1UaGFsZXMgVFNTIEVT
# TjpCMUI3LUY2N0YtRkVDMjElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAg
# U2VydmljZaIlCgEBMAkGBSsOAwIaBQADFQBw+Ch/1VIzmUVpODcOv+U5mO7zwqCB
# 3jCB26SB2DCB1TELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
# BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEp
# MCcGA1UECxMgTWljcm9zb2Z0IE9wZXJhdGlvbnMgUHVlcnRvIFJpY28xJzAlBgNV
# BAsTHm5DaXBoZXIgTlRTIEVTTjo0REU5LTBDNUUtM0UwOTErMCkGA1UEAxMiTWlj
# cm9zb2Z0IFRpbWUgU291cmNlIE1hc3RlciBDbG9jazANBgkqhkiG9w0BAQUFAAIF
# AOBZ8DAwIhgPMjAxOTA0MTIwMDU2MTZaGA8yMDE5MDQxMzAwNTYxNlowdzA9Bgor
# BgEEAYRZCgQBMS8wLTAKAgUA4FnwMAIBADAKAgEAAgIhTQIB/zAHAgEAAgIXxDAK
# AgUA4FtBsAIBADA2BgorBgEEAYRZCgQCMSgwJjAMBgorBgEEAYRZCgMBoAowCAIB
# AAIDFuNgoQowCAIBAAIDB6EgMA0GCSqGSIb3DQEBBQUAA4IBAQASawKuw3twduDK
# 6O4YxvObEwP2C+m62McUTWpSt/g6iZIW0Ejcax5xGmEAiS3YOY3f13ubfV5mM36f
# r0me8US51nSjrOetaBgPPFWM8VcKyB/bw44gMfopGSfffgGXn6cElhNei2KqnRSn
# 1No5BUuCSsFadRAcv/D+jtiHcD8VGuvmNB8nV5pU7y8vL8JOM3aeZlhdIqFMRR2j
# qEUWrHDZGNYE/WDjwPiZ1MBkREAaHMV7UXO2BLAT4O5jTysNP663pNJ7LFLQYQW6
# GCGBnRjPPosYw4MmyTDgOnYs12HcKgvL5FuBK/BFXVU6nDiwRo15kbjvF/WxPax3
# S0oC4CTLMYIC9TCCAvECAQEwgZMwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldh
# c2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBD
# b3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIw
# MTACEzMAAADSuONabcRbGncAAAAAANIwDQYJYIZIAWUDBAIBBQCgggEyMBoGCSqG
# SIb3DQEJAzENBgsqhkiG9w0BCRABBDAvBgkqhkiG9w0BCQQxIgQg6HXoYv4020Yb
# Nb1eiOdUoZwuxJxUcXYWQRvWMKxgq5YwgeIGCyqGSIb3DQEJEAIMMYHSMIHPMIHM
# MIGxBBRw+Ch/1VIzmUVpODcOv+U5mO7zwjCBmDCBgKR+MHwxCzAJBgNVBAYTAlVT
# MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1l
# LVN0YW1wIFBDQSAyMDEwAhMzAAAA0rjjWm3EWxp3AAAAAADSMBYEFA94B9WVYnCh
# Pmuz5djBH0qi8M2uMA0GCSqGSIb3DQEBCwUABIIBAAhRLBOnnXuppE0a2nseiZFS
# HBbJLy3CHJm13pDGul6BgjhP/81oN0gH/+qE3YZPUqonoSwFbVcX+FztgsUaYrps
# MWJNrEHRWSpbaqN+wOox67I0p6EGtlRsFCLXG0QHKfFcfgMIf3fWP8/qFq8O5JnN
# dD36P8tCuiIgZtb9/AAtfdZxU/WsZAno4f+J8gQ+rC5n42lItfWuuQQej1p7qRL5
# FeMAM//4b4ctl6zrxoyjukt8byW49TcKw+BXCm8knDQzA8wIb9SbO+1un9jh2sAg
# woyZaDdCbGVb5m8oP2Ev6H3iSfs0arXMf+NOkD+9dLgoL/SyTkXI4Pxp/pz7OGU=
# SIG # End signature block
