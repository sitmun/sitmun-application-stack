# PowerShell ANSI color codes
$Red = "`e[31m"      # Red for errors
$Green = "`e[32m"    # Green for success messages
$Yellow = "`e[33m"   # Yellow for warnings or process info
$Reset = "`e[0m"     # Reset color

# Define the expected Git repository URL
$EXPECTED_REPO = "https://github.com/sitmun/sitmun-application-stack.git"

# Display a banner
function Display-Banner {
    Write-Host "${Green}"
    Write-Host "############################################################"
    Write-Host "#                                                          #"
    Write-Host "#              SITMUN Application Stack Setup              #"
    Write-Host "#                                                          #"
    Write-Host "############################################################"
    Write-Host "${Reset}"
}

# Check if the current directory is a Git repository
function Check-GitRepository {
    Write-Host "${Yellow}Checking if the current directory is a Git repository...${Reset}"
    if (-Not (Test-Path ".git")) {
        Write-Host "${Red}Error: The current directory is not a Git repository.${Reset}"
        exit 1
    }
}

# Check if the repository matches the expected one
function Check-RepositoryURL {
    Write-Host "${Yellow}Checking if the repository matches the expected SITMUN Application Stack repository...${Reset}"
    $REMOTE_URL = git config --get remote.origin.url
    if ($REMOTE_URL -ne $EXPECTED_REPO) {
        Write-Host "${Red}Error: The repository does not match the expected SITMUN Application Stack repository.${Reset}"
        Write-Host "Expected: ${Yellow}$EXPECTED_REPO${Reset}"
        Write-Host "Found:    ${Yellow}$REMOTE_URL${Reset}"
        exit 1
    }
}

# Update from the remote branch without overriding .env file if it exists
function Update-FromRemote {
    $CURRENT_BRANCH = git rev-parse --abbrev-ref HEAD
    Write-Host "${Yellow}Updating from the remote $CURRENT_BRANCH branch...${Reset}"

    # Fetch latest changes from remote
    git fetch origin $CURRENT_BRANCH

    # Check if local is up to date
    $LOCAL_COMMIT = git rev-parse "@"
    $REMOTE_COMMIT = git rev-parse "@{u}"

    if ($LOCAL_COMMIT -eq $REMOTE_COMMIT) {
        Write-Host "${Green}Your $CURRENT_BRANCH branch is already up to date.${Reset}"
        git submodule update --recursive --remote
    } else {
        Write-Host "${Yellow}Pulling latest changes from remote...${Reset}"

        if (Test-Path ".env") {
            Write-Host "${Yellow}.env file exists. Creating a backup...${Reset}"
            Copy-Item -Path ".env" -Destination ".env.backup"
        }

        git pull --recurse-submodules origin $CURRENT_BRANCH

        if (Test-Path ".env.backup") {
            Write-Host "${Yellow}Restoring .env file from backup...${Reset}"
            Copy-Item -Path ".env.backup" -Destination ".env" -Force
        }
    }
}

# Copy .env.example to .env if .env does not exist
function Copy-EnvFileIfMissing {
    if (-Not (Test-Path ".env")) {
        Write-Host "${Yellow}.env file is missing. Copying .env.example to .env...${Reset}"
        Copy-Item -Path ".env.example" -Destination ".env"
        Write-Host "${Green}.env file created from .env.example.${Reset}"
    }
}

# Main logic
Display-Banner
Check-GitRepository
Check-RepositoryURL
Update-FromRemote
Copy-EnvFileIfMissing
