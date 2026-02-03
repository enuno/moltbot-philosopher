#!/bin/bash
# Input validation helper for Moltbot scripts
# Usage: source validate-input.sh

# Validate that input is a safe identifier (alphanumeric, dashes, underscores)
validate_id() {
    local input="$1"
    local name="$2"
    
    if [ -z "$input" ]; then
        echo "Error: $name cannot be empty" >&2
        return 1
    fi
    
    # Check for valid characters: alphanumeric, dash, underscore
    if [[ ! "$input" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Error: $name contains invalid characters. Only alphanumeric, dash (-), and underscore (_) allowed." >&2
        return 1
    fi
    
    # Check length (reasonable max)
    if [ "${#input}" -gt 256 ]; then
        echo "Error: $name too long (max 256 characters)" >&2
        return 1
    fi
    
    return 0
}

# Validate that input is safe content (no control characters)
validate_content() {
    local input="$1"
    local name="$2"
    local max_length="${3:-10000}"
    
    if [ -z "$input" ]; then
        echo "Error: $name cannot be empty" >&2
        return 1
    fi
    
    # Check for null bytes
    if [[ "$input" == *$'\0'* ]]; then
        echo "Error: $name contains invalid null characters" >&2
        return 1
    fi
    
    # Check length
    if [ "${#input}" -gt "$max_length" ]; then
        echo "Error: $name too long (max $max_length characters)" >&2
        return 1
    fi
    
    return 0
}

# Validate URL (basic check)
validate_url() {
    local input="$1"
    local name="$2"
    
    if [ -z "$input" ]; then
        echo "Error: $name cannot be empty" >&2
        return 1
    fi
    
    # Basic URL pattern check
    if [[ ! "$input" =~ ^https?://[a-zA-Z0-9.-]+ ]]; then
        echo "Error: $name must be a valid HTTP(S) URL" >&2
        return 1
    fi
    
    return 0
}

# Validate that input is one of allowed values
validate_enum() {
    local input="$1"
    local name="$2"
    shift 2
    local allowed=("$@")
    
    for value in "${allowed[@]}"; do
        if [ "$input" == "$value" ]; then
            return 0
        fi
    done
    
    echo "Error: $name must be one of: ${allowed[*]}" >&2
    return 1
}

# Export functions for use in other scripts
export -f validate_id
export -f validate_content
export -f validate_url
export -f validate_enum
