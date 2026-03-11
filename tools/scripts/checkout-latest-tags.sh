#!/bin/bash

# SITMUN Application Stack - Checkout Latest Tags Script
# This script checks out all submodules to their latest tags

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}



# Function to checkout submodule to latest tag
checkout_submodule_to_latest_tag() {
    local submodule_path="$1"
    local submodule_name="$2"
    
    log_info "Processing submodule: $submodule_name"
    
    if [ ! -d "$submodule_path" ]; then
        log_error "Submodule directory not found: $submodule_path"
        return 1
    fi
    
    # Get current branch/tag
    cd "$submodule_path"
    local current_ref=$(git describe --tags --exact-match 2>/dev/null || git rev-parse --abbrev-ref HEAD)
    log_info "Current reference: $current_ref"
    log_info "Submodule name: $submodule_name"
    log_info "Submodule path: $submodule_path"

    # Get latest tag (inlined logic)
    local latest_tag=""
    
    # Fetch latest tags from remote
    git fetch --tags --quiet
    
    # Try different tag patterns based on submodule
    case "$submodule_name" in
        "sitmun-admin-app")
            latest_tag=$(git tag --sort=-version:refname | grep "^sitmun-admin-app/" | head -1)
            ;;
        "sitmun-viewer-app")
            latest_tag=$(git tag --sort=-version:refname | grep "^sitmun-viewer-app/" | head -1)
            ;;
        "sitmun-backend-core")
            latest_tag=$(git tag --sort=-version:refname | grep "^sitmun-backend-core/" | head -1)
            ;;
        "sitmun-proxy-middleware")
            latest_tag=$(git tag --sort=-version:refname | grep "^sitmun-proxy-middleware/" | head -1)
            ;;
        *)
            # Fallback: get the most recent tag
            latest_tag=$(git tag --sort=-version:refname | head -1)
            ;;
    esac
    
    if [ -z "$latest_tag" ]; then
        log_warning "No tags found for $submodule_name, skipping..."
        cd - > /dev/null
        return 0
    fi
    
    log_info "Latest tag: $latest_tag"
    
    # Check if already on the latest tag
    if [ "$current_ref" = "$latest_tag" ]; then
        log_success "$submodule_name is already on latest tag: $latest_tag"
        cd - > /dev/null
        return 0
    fi
    
    # Checkout to the latest tag
    log_info "Checking out $submodule_name to tag: $latest_tag"
    if git checkout "$latest_tag" --quiet; then
        log_success "Successfully checked out $submodule_name to tag: $latest_tag"
    else
        log_error "Failed to checkout $submodule_name to tag: $latest_tag"
        cd - > /dev/null
        return 1
    fi
    
    cd - > /dev/null
}

# Main script
main() {
    log_info "Starting SITMUN submodule tag checkout process..."
    
    # Check if we're in the right directory
    if [ ! -f ".gitmodules" ]; then
        log_error "This script must be run from the root of the SITMUN application stack repository"
        exit 1
    fi
    
    # Initialize submodules if not already done
    log_info "Checking submodule status..."
    if ! git submodule status | grep -q "^ "; then
        log_info "Initializing submodules..."
        git submodule init
        git submodule update
    else
        log_info "Submodules already initialized"
    fi
    
    # Ensure all submodule directories exist and are up to date
    log_info "Ensuring all submodules are initialized and up to date..."
    # Only update if submodules are not already initialized
    if ! git submodule status | grep -q "^ "; then
        git submodule update --init --recursive
    fi
    
    # Define submodules and their paths (compatible with older bash versions)
    local submodule_names=("sitmun-admin-app" "sitmun-viewer-app" "sitmun-backend-core" "sitmun-proxy-middleware")
    local submodule_paths=("front/admin/sitmun-admin-app" "front/viewer/sitmun-viewer-app" "back/backend/sitmun-backend-core" "back/proxy/sitmun-proxy-middleware")
    
    local failed_submodules=()
    
    # Process each submodule
    for i in "${!submodule_names[@]}"; do
        local submodule_name="${submodule_names[$i]}"
        local submodule_path="${submodule_paths[$i]}"
        
        if checkout_submodule_to_latest_tag "$submodule_path" "$submodule_name"; then
            log_success "✓ $submodule_name processed successfully"
        else
            log_error "✗ Failed to process $submodule_name"
            failed_submodules+=("$submodule_name")
        fi
        
        echo  # Add spacing between submodules
    done
    
    # Summary
    echo "=========================================="
    log_info "Checkout process completed!"
    
    if [ ${#failed_submodules[@]} -eq 0 ]; then
        log_success "All submodules successfully checked out to their latest tags"
    else
        log_warning "Some submodules failed to checkout:"
        for submodule in "${failed_submodules[@]}"; do
            log_error "  - $submodule"
        done
        exit 1
    fi
    
    # Show current status
    echo
    log_info "Current submodule status:"
    git submodule status
}

# Run main function
main "$@"
