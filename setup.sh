#!/bin/bash

# ANSI color codes for better visibility in terminal output
RED='\033[0;31m'     # Red for errors
GREEN='\033[0;32m'   # Green for success messages
YELLOW='\033[0;33m'  # Yellow for warnings or process info
NC='\033[0m'         # Reset color

# Define the expected Git repository URL
EXPECTED_REPO="https://github.com/sitmun/sitmun-application-stack.git"

# Display a banner
display_banner() {
    echo -e "${GREEN}"
    echo -e "############################################################"
    echo -e "#                                                          #"
    echo -e "#              SITMUN Application Stack Setup              #"
    echo -e "#                                                          #"
    echo -e "############################################################"
    echo -e "${NC}"
}


# Check if the current directory is a Git repository
check_git_repository() {
    echo -e "${YELLOW}Checking if the current directory is a Git repository...${NC}"
    if [ ! -d ".git" ]; then
        echo -e "${RED}Error: The current directory is not a Git repository.${NC}"
        exit 1
    fi
}

# Check if the repository matches the expected one
check_repository_url() {
    echo -e "${YELLOW}Checking if the repository matches the expected SITMUN Application Stack repository...${NC}"
    REMOTE_URL=$(git config --get remote.origin.url)
    if [ "$REMOTE_URL" != "$EXPECTED_REPO" ]; then
        echo -e "${RED}Error: The repository does not match the expected SITMUN Application Stack repository.${NC}"
        echo -e "Expected: ${YELLOW}$EXPECTED_REPO${NC}"
        echo -e "Found:    ${YELLOW}$REMOTE_URL${NC}"
        exit 1
    fi
}

# Update from the remote branch without overriding .env file if it exists
update_from_remote() {
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    echo -e "${YELLOW}Updating from the remote ${CURRENT_BRANCH} branch...${NC}"

    # Fetch latest changes from remote
    git fetch origin "$CURRENT_BRANCH"

    # Check if local is up to date
    LOCAL_COMMIT=$(git rev-parse @)
    REMOTE_COMMIT=$(git rev-parse @{u})

    if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
        echo -e "${GREEN}Your $CURRENT_BRANCH branch is already up to date.${NC}"
    else
        echo -e "${YELLOW}Pulling latest changes from remote...${NC}"

        if [ -f ".env" ]; then
            echo -e "${YELLOW}.env file exists. Creating a backup...${NC}"
            cp .env .env.backup
        fi

        git pull --recurse-submodules origin "$CURRENT_BRANCH"

        if [ -f ".env.backup" ]; then
            echo -e "${YELLOW}Restoring .env file from backup...${NC}"
            cp .env.backup .env
        fi
    fi
}

# Copy .env.example to .env if .env does not exist
copy_env_file_if_missing() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}.env file is missing. Copying .env.example to .env...${NC}"
        cp .env.example .env
        echo -e "${GREEN}.env file created from .env.example.${NC}"
    fi
}

# Main logic
display_banner
check_git_repository
check_repository_url
update_from_remote
copy_env_file_if_missing
