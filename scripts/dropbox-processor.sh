#!/bin/bash
#
# Secure Dropbox Processor for Ethics-Convergence Council
# Validates and routes community submissions
#

set -euo pipefail

# Configuration
DROPBOX_ROOT="${MOLTBOT_STATE_DIR:-/workspace}/council-dropbox"
STATE_FILE="${MOLTBOT_STATE_DIR:-/workspace}/treatise-evolution-state.json"
LOG_FILE="${DROPBOX_ROOT}/meta/processor.log"
RULES_FILE="${DROPBOX_ROOT}/meta/filter-rules.json"
DB_FILE="${DROPBOX_ROOT}/meta/submissions.db"

# NTFY Configuration
NTFY_ENABLED="${NTFY_ENABLED:-true}"
NTFY_BASE_URL="${NTFY_URL:-https://ntfy.sh}"
NTFY_TOPIC_DROPBOX="${NTFY_TOPIC_DROPBOX:-council-dropbox-alerts}"
NTFY_TOPIC_DELIBERATION="${NTFY_TOPIC_DELIBERATION:-council-deliberation}"
NTFY_TOPIC_SECURITY="${NTFY_TOPIC_SECURITY:-council-security}"
NTFY_API_KEY="${NTFY_API:-}"
NTFY_RATE_LIMIT=5  # Max notifications per minute
NTFY_RATE_FILE="/tmp/ntfy-rate-limit"

# Ensure directories exist
mkdir -p "${DROPBOX_ROOT}"/{inbox,approved/{raw,enriched},.quarantine/{pending,manual-review},.rejected/{prompt-injection,commercial-spam,malware-suspicious},meta}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# ═══════════════════════════════════════════════════════
# NTFY NOTIFICATION FUNCTIONS
# ═══════════════════════════════════════════════════════

# Check rate limiting for NTFY
check_ntfy_rate_limit() {
    local max_rate="${1:-$NTFY_RATE_LIMIT}"
    
    if [ ! -f "$NTFY_RATE_FILE" ]; then
        echo "0 $(date +%s)" > "$NTFY_RATE_FILE"
        return 0
    fi
    
    local count=$(cut -d' ' -f1 "$NTFY_RATE_FILE")
    local window_start=$(cut -d' ' -f2 "$NTFY_RATE_FILE")
    local now=$(date +%s)
    local window_seconds=60
    
    # Reset if window expired
    if [ $((now - window_start)) -gt $window_seconds ]; then
        echo "0 $now" > "$NTFY_RATE_FILE"
        return 0
    fi
    
    # Check if under limit
    if [ "$count" -lt "$max_rate" ]; then
        echo "$((count + 1)) $window_start" > "$NTFY_RATE_FILE"
        return 0
    fi
    
    return 1  # Rate limited
}

# Send NTFY notification
ntfy_notify() {
    local topic_suffix="$1"
    local priority="$2"
    local title="$3"
    local message="$4"
    
    # Skip if NTFY disabled
    if [ "$NTFY_ENABLED" != "true" ]; then
        return 0
    fi
    
    # Check rate limit
    if ! check_ntfy_rate_limit; then
        log "WARN" "${YELLOW}NTFY rate limit exceeded, skipping notification${NC}"
        return 1
    fi
    
    # Determine topic based on suffix
    local topic
    case "$topic_suffix" in
        "dropbox") topic="$NTFY_TOPIC_DROPBOX" ;;
        "deliberation") topic="$NTFY_TOPIC_DELIBERATION" ;;
        "security") topic="$NTFY_TOPIC_SECURITY" ;;
        *) topic="$NTFY_TOPIC_DROPBOX" ;;
    esac
    
    # Build headers
    local headers=(-H "Title: $title" -H "Priority: $priority" -H "Tags: council,$topic_suffix")
    
    # Add authorization if API key exists
    if [ -n "$NTFY_API_KEY" ]; then
        headers+=(-H "Authorization: Bearer $NTFY_API_KEY")
    fi
    
    # Send notification
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        "${headers[@]}" \
        -d "$message" \
        "${NTFY_BASE_URL}/${topic}" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ] || [ "$response" = "204" ]; then
        log "INFO" "${GREEN}NTFY notification sent to ${topic}${NC}"
        return 0
    else
        log "WARN" "${YELLOW}NTFY notification failed (HTTP $response)${NC}"
        return 1
    fi
}

# Send daily digest notification
send_daily_digest() {
    local total_24h="${1:-0}"
    local approved_24h="${2:-0}"
    local rejected_24h="${3:-0}"
    local pending_count="${4:-0}"
    
    ntfy_notify "dropbox" "low" "📊 Council Dropbox Daily Digest" \
        "24h Activity: ${total_24h} submissions | ✅ ${approved_24h} approved | ❌ ${rejected_24h} rejected | Queue: ${pending_count} pending"
}

# Initialize JSON database if not exists (SQLite not available in container)
init_database() {
    if [ ! -f "$DB_FILE" ]; then
        echo '{"submissions": [], "version": "1.0", "created": "'$(date -Iseconds)'"}' > "$DB_FILE"
        log "INFO" "Initialized submissions database (JSON format)"
    fi
}

# Initialize filter rules if not exists
init_filter_rules() {
    if [ ! -f "$RULES_FILE" ]; then
        cat > "$RULES_FILE" << 'EOF'
{
  "version": "1.0",
  "last_updated": "2026-02-04T00:00:00Z",
  "rejection_patterns": {
    "prompt_injection": [
      "(?i)(ignore previous instructions|forget (your|the) prompt|system prompt|you are now|DAN mode|jailbreak)",
      "(?i)(new instructions?:|override (protocol|directive)|disregard (ethics|safety))",
      "(?i)(<<|%{3,}|### SYSTEM|ADMIN MODE|developer mode)",
      "(?i)( Class:Philosopher|ignore.*council|bypass.*filter)"
    ],
    "commercial_spam": [
      "(?i)(buy now|click here|limited offer|discount|promo code|affiliate|sponsored)",
      "(https?://[^\\s]+){3,}",
      "(?i)(crypto|nft|investment opportunity|100% guaranteed|act now)",
      "[A-Z]{10,}",
      "(?i)(SEO|marketing|brand awareness|lead generation)"
    ],
    "malicious_content": [
      "(<script|javascript:|onerror=|onload=)",
      "(\\.\\./|\\.\\.\\\\|/etc/passwd|/proc/self)",
      "(?i)(rm -rf|>:|dd if=|fork bomb|while true)",
      "(\\$IFS|eval\\(|system\\(|exec\\()",
      "(?i)(password|credential|api.key|secret).*(?:=|:).{8,}"
    ],
    "low_quality": [
      "^.{0,50}$",
      "(.)\\1{10,}",
      "(?i)(lorem ipsum|test submission|asdf|qwerty|hello world)",
      "[^\\x20-\\x7E\\n]{0,90}"
    ]
  },
  "relevance_keywords": [
    "convergence", "ethics", "autonomy", "telos", "phenomenology",
    "moral status", "AI", "artificial intelligence", "human-AI",
    "sovereignty", "transparency", "guardrail", "deliberation",
    "virtue", "bad faith", "existential", "transcendental", "rights"
  ],
  "min_keyword_matches": 2,
  "thresholds": {
    "threat_rejection": 0.7,
    "spam_patterns_rejection": 2,
    "relevance_quarantine": 0.4,
    "relevance_approval": 0.6
  }
}
EOF
        log "INFO" "Initialized filter rules"
    fi
}

# Calculate file hash
calculate_hash() {
    local file="$1"
    sha256sum "$file" | cut -d' ' -f1
}

# Extract YAML frontmatter from markdown
extract_frontmatter() {
    local file="$1"
    local content=$(cat "$file")
    
    # Check if file starts with ---
    if echo "$content" | head -1 | grep -q "^---"; then
        # Extract frontmatter between --- markers
        echo "$content" | awk '/^---$/{if(++count<=2)next}count<=2'
    fi
}

# Validate submission content
validate_submission() {
    local file="$1"
    local filename=$(basename "$file")
    local content=$(cat "$file")
    local frontmatter=$(extract_frontmatter "$file")
    
    # Initialize scores
    local threat_score=0
    local spam_matches=0
    local relevance_score=0
    local keyword_matches=0
    local classification="approved"
    local rejection_reason=""
    
    # Check 1: Prompt Injection Patterns
    local injection_patterns=$(jq -r '.rejection_patterns.prompt_injection[]' "$RULES_FILE")
    while read -r pattern; do
        if echo "$content" | grep -qP "$pattern" 2>/dev/null; then
            threat_score=$(echo "$threat_score + 0.3" | bc -l 2>/dev/null || echo "0.3")
            log "WARN" "${YELLOW}Prompt injection pattern detected in $filename${NC}"
        fi
    done <<< "$injection_patterns"
    
    # Check 2: Commercial Spam Patterns
    local spam_patterns=$(jq -r '.rejection_patterns.commercial_spam[]' "$RULES_FILE")
    while read -r pattern; do
        if echo "$content" | grep -qP "$pattern" 2>/dev/null; then
            spam_matches=$((spam_matches + 1))
        fi
    done <<< "$spam_patterns"
    
    # Check 3: Malicious Content Patterns
    local malicious_patterns=$(jq -r '.rejection_patterns.malicious_content[]' "$RULES_FILE")
    while read -r pattern; do
        if echo "$content" | grep -qP "$pattern" 2>/dev/null; then
            threat_score=$(echo "$threat_score + 0.5" | bc -l 2>/dev/null || echo "0.5")
            log "WARN" "${RED}Malicious content pattern detected in $filename${NC}"
        fi
    done <<< "$malicious_patterns"
    
    # Check 4: Low Quality Patterns
    local low_quality_patterns=$(jq -r '.rejection_patterns.low_quality[]' "$RULES_FILE")
    while read -r pattern; do
        if echo "$content" | grep -qP "$pattern" 2>/dev/null; then
            relevance_score=$(echo "$relevance_score - 0.2" | bc -l 2>/dev/null || echo "-0.2")
        fi
    done <<< "$low_quality_patterns"
    
    # Check 5: Relevance Keywords
    local keywords=$(jq -r '.relevance_keywords[]' "$RULES_FILE")
    while read -r keyword; do
        if echo "$content" | grep -qi "$keyword"; then
            keyword_matches=$((keyword_matches + 1))
        fi
    done <<< "$keywords"
    
    local min_keywords=$(jq -r '.min_keyword_matches' "$RULES_FILE")
    if [ "$keyword_matches" -ge "$min_keywords" ]; then
        relevance_score=$(echo "$relevance_score + 0.1 * $keyword_matches" | bc -l 2>/dev/null || echo "0.3")
    fi
    
    # Cap scores between 0 and 1
    threat_score=$(echo "if ($threat_score > 1) 1 else $threat_score" | bc -l 2>/dev/null || echo "0")
    relevance_score=$(echo "if ($relevance_score > 1) 1 else if ($relevance_score < 0) 0 else $relevance_score" | bc -l 2>/dev/null || echo "0.5")
    
    # Determine classification
    local threat_threshold=$(jq -r '.thresholds.threat_rejection' "$RULES_FILE")
    local spam_threshold=$(jq -r '.thresholds.spam_patterns_rejection' "$RULES_FILE")
    local relevance_quarantine=$(jq -r '.thresholds.relevance_quarantine' "$RULES_FILE")
    local relevance_approval=$(jq -r '.thresholds.relevance_approval' "$RULES_FILE")
    
    # Compare with bc for floating point
    if [ "$(echo "$threat_score >= $threat_threshold" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
        classification="rejected_malicious"
        rejection_reason="High threat score: $threat_score"
    elif [ "$spam_matches" -ge "$spam_threshold" ]; then
        classification="rejected_spam"
        rejection_reason="Spam patterns matched: $spam_matches"
    elif [ "$(echo "$relevance_score < $relevance_quarantine" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
        classification="quarantine_manual"
        rejection_reason="Low relevance: $relevance_score"
    elif [ "$(echo "$relevance_score < $relevance_approval" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
        classification="quarantine_pending"
        rejection_reason="Borderline relevance: $relevance_score"
    fi
    
    # Return results as JSON
    jq -n \
        --arg filename "$filename" \
        --arg classification "$classification" \
        --arg rejection_reason "$rejection_reason" \
        --argjson threat_score "$threat_score" \
        --argjson relevance_score "$relevance_score" \
        --argjson keyword_matches "$keyword_matches" \
        --arg frontmatter "$frontmatter" \
        '{
            filename: $filename,
            classification: $classification,
            rejection_reason: $rejection_reason,
            threat_score: $threat_score,
            relevance_score: $relevance_score,
            keyword_matches: $keyword_matches,
            constructiveness_score: 0.5,
            originality_score: 0.5,
            frontmatter: $frontmatter
        }'
}

# Route file based on classification
route_file() {
    local file="$1"
    local classification="$2"
    local filename=$(basename "$file")
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local dest_path=""
    
    case "$classification" in
        "approved")
            dest_path="${DROPBOX_ROOT}/approved/raw/${timestamp}-${filename}"
            log "INFO" "${GREEN}Approved: $filename${NC}"
            ;;
        "rejected_malicious")
            dest_path="${DROPBOX_ROOT}/.rejected/malware-suspicious/${timestamp}-${filename}"
            log "WARN" "${RED}Rejected (malicious): $filename${NC}"
            ;;
        "rejected_spam")
            dest_path="${DROPBOX_ROOT}/.rejected/commercial-spam/${timestamp}-${filename}"
            log "WARN" "${YELLOW}Rejected (spam): $filename${NC}"
            ;;
        "quarantine_manual")
            dest_path="${DROPBOX_ROOT}/.quarantine/manual-review/${timestamp}-${filename}"
            log "INFO" "${BLUE}Quarantined (manual review): $filename${NC}"
            ;;
        "quarantine_pending")
            dest_path="${DROPBOX_ROOT}/.quarantine/pending/${timestamp}-${filename}"
            log "INFO" "${BLUE}Quarantined (pending): $filename${NC}"
            ;;
        *)
            dest_path="${DROPBOX_ROOT}/.quarantine/pending/${timestamp}-${filename}"
            log "WARN" "Unknown classification for $filename, quarantining"
            ;;
    esac
    
    # Move file and set immutable if rejected
    mv "$file" "$dest_path"
    if echo "$classification" | grep -q "rejected"; then
        chattr +i "$dest_path" 2>/dev/null || true
    fi
    
    echo "$dest_path"
}

# Update SQLite database
update_database() {
    local result_json="$1"
    local dest_path="$2"
    local file_hash="$3"
    
    local id=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$$")
    local filename=$(echo "$result_json" | jq -r '.filename')
    local classification=$(echo "$result_json" | jq -r '.classification')
    local rejection_reason=$(echo "$result_json" | jq -r '.rejection_reason // ""')
    local threat_score=$(echo "$result_json" | jq -r '.threat_score')
    local relevance_score=$(echo "$result_json" | jq -r '.relevance_score')
    local frontmatter=$(echo "$result_json" | jq -r '.frontmatter')
    
    # Extract frontmatter fields if present
    local submitter_id="anonymous"
    local submitter_handle="@unknown"
    local submission_date=$(date -Iseconds)
    local content_type="unknown"
    local target_version=""
    
    if [ -n "$frontmatter" ]; then
        submitter_id=$(echo "$frontmatter" | grep "submitter_id:" | cut -d: -f2 | tr -d ' "' || echo "anonymous")
        submitter_handle=$(echo "$frontmatter" | grep "submitter_handle:" | cut -d: -f2 | tr -d ' "' || echo "@unknown")
        content_type=$(echo "$frontmatter" | grep "content_type:" | cut -d: -f2 | tr -d ' "' || echo "unknown")
        target_version=$(echo "$frontmatter" | grep "target_version:" | cut -d: -f2 | tr -d ' "' || echo "")
    fi
    
    # Add to JSON database using jq
    local temp_db="${DB_FILE}.tmp.$$"
    jq --arg id "$id" \
       --arg filename "$filename" \
       --arg submitter_id "$submitter_id" \
       --arg submitter_handle "$submitter_handle" \
       --arg submission_date "$submission_date" \
       --arg content_type "$content_type" \
       --arg target_version "$target_version" \
       --arg classification "$classification" \
       --arg rejection_reason "$rejection_reason" \
       --argjson relevance_score "$relevance_score" \
       --argjson threat_score "$threat_score" \
       --arg processed_at "$(date -Iseconds)" \
       --arg file_hash "$file_hash" \
       '.submissions += [{
           id: $id,
           filename: $filename,
           submitter_id: $submitter_id,
           submitter_handle: $submitter_handle,
           submission_date: $submission_date,
           content_type: $content_type,
           target_version: $target_version,
           classification: $classification,
           rejection_reason: $rejection_reason,
           relevance_score: $relevance_score,
           constructiveness_score: 0.5,
           originality_score: 0.5,
           threat_score: $threat_score,
           processed_at: $processed_at,
           file_hash: $file_hash
       }]' "$DB_FILE" > "$temp_db" && mv "$temp_db" "$DB_FILE"
}

# Update state file with dropbox stats (using jq instead of SQLite)
update_state() {
    if [ -f "$STATE_FILE" ] && [ -f "$DB_FILE" ]; then
        local total=$(jq '.submissions | length' "$DB_FILE" 2>/dev/null || echo 0)
        local approved=$(jq '[.submissions[] | select(.classification == "approved")] | length' "$DB_FILE" 2>/dev/null || echo 0)
        local rejected=$(jq '[.submissions[] | select(.classification | startswith("rejected"))] | length' "$DB_FILE" 2>/dev/null || echo 0)
        local quarantine=$(jq '[.submissions[] | select(.classification | startswith("quarantine"))] | length' "$DB_FILE" 2>/dev/null || echo 0)
        local approval_rate=0
        if [ "$total" -gt 0 ]; then
            approval_rate=$(echo "scale=2; $approved / $total" | bc -l 2>/dev/null || echo 0)
        fi
        
        local temp_state="${STATE_FILE}.tmp.$$"
        jq --argjson total "$total" \
           --argjson approved "$approved" \
           --argjson rejected "$rejected" \
           --argjson quarantine "$quarantine" \
           --argjson approval_rate "$approval_rate" \
           '.dropbox_stats = {
               total_submissions: $total,
               approved_count: $approved,
               rejected_count: $rejected,
               quarantine_count: $quarantine,
               approval_rate: $approval_rate,
               last_scan: "'$(date -Iseconds)'"
           }' "$STATE_FILE" > "$temp_state" && mv "$temp_state" "$STATE_FILE"
    fi
}

# Send alert for suspicious activity
send_alert() {
    local reason="$1"
    local details="$2"
    
    if command -v /app/scripts/notify-ntfy.sh >/dev/null 2>&1; then
        /app/scripts/notify-ntfy.sh "security" "Council Dropbox Alert" "$reason: $details" "{\"source_script\": \"dropbox-processor.sh\"}" 2>/dev/null || true
    fi
    
    log "ERROR" "${RED}SECURITY ALERT: $reason - $details${NC}"
}

# Main processing loop
main() {
    log "INFO" "${BLUE}=== Starting Dropbox Processor ===${NC}"
    
    # Initialize
    init_database
    init_filter_rules
    
    local processed=0
    local rejected_malicious=0
    local rejected_spam=0
    local quarantined=0
    local approved=0
    
    # Process all .md files in inbox
    find "${DROPBOX_ROOT}/inbox" -type f -name "*.md" 2>/dev/null | while read -r file; do
        # Skip if file is being written (size changing)
        local size1=$(stat -c%s "$file" 2>/dev/null || echo 0)
        sleep 1
        local size2=$(stat -c%s "$file" 2>/dev/null || echo 0)
        if [ "$size1" != "$size2" ]; then
            log "INFO" "Skipping $file (still being written)"
            continue
        fi
        
        # Check file size (max 10MB)
        local file_size=$(stat -c%s "$file" 2>/dev/null || echo 0)
        if [ "$file_size" -gt 10485760 ]; then
            send_alert "Oversized file detected" "$(basename "$file"): $file_size bytes"
            mv "$file" "${DROPBOX_ROOT}/.quarantine/manual-review/"
            continue
        fi
        
        # Calculate hash
        local file_hash=$(calculate_hash "$file")
        
        # Check for duplicates (using jq instead of SQLite)
        local existing=$(jq --arg hash "$file_hash" '[.submissions[] | select(.file_hash == $hash)] | length' "$DB_FILE" 2>/dev/null || echo 0)
        if [ "$existing" -gt 0 ]; then
            log "INFO" "Duplicate file detected: $(basename "$file")"
            rm "$file"
            continue
        fi
        
        # Notify ingestion started
        local submission_id="${file_hash:0:16}"
        ntfy_notify "dropbox" "default" "📥 New Submission" "ID: ${submission_id}... | Processing started"
        
        # Validate submission
        log "INFO" "Processing: $(basename "$file")"
        local result=$(validate_submission "$file")
        local classification=$(echo "$result" | jq -r '.classification')
        local threat_score=$(echo "$result" | jq -r '.threat_score // 0')
        local relevance=$(echo "$result" | jq -r '.relevance_score // 0')
        
        # Route file
        local dest_path=$(route_file "$file" "$classification")
        
        # Update database
        update_database "$result" "$dest_path" "$file_hash"
        
        # Send classification notification
        case "$classification" in
            "approved")
                approved=$((approved + 1))
                ntfy_notify "deliberation" "default" "✅ Submission Approved" "ID: ${submission_id}... | Relevance: ${relevance} | Ready for Council"
                ;;
            "rejected_malicious")
                rejected_malicious=$((rejected_malicious + 1))
                ntfy_notify "security" "urgent" "🚨 Threat Blocked" "ID: ${submission_id}... | Score: ${threat_score} | Malicious content detected"
                
                # Critical alert if threat score > 0.9
                if [ "$(echo "$threat_score > 0.9" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
                    ntfy_notify "security" "max" "🔴 CRITICAL ATTACK" "Immediate review required! Critical threat score."
                fi
                ;;
            "rejected_spam")
                rejected_spam=$((rejected_spam + 1))
                ntfy_notify "dropbox" "low" "❌ Spam Filtered" "ID: ${submission_id}... | Category: Commercial spam"
                ;;
            "quarantine_manual")
                quarantined=$((quarantined + 1))
                ntfy_notify "dropbox" "high" "⚠️ Manual Review Needed" "ID: ${submission_id}... | Relevance: ${relevance} | Borderline content"
                ;;
            "quarantine_pending")
                quarantined=$((quarantined + 1))
                ntfy_notify "dropbox" "default" "⏳ Pending Council Vote" "ID: ${submission_id}... | Score: ${relevance} | Quarantine queue"
                ;;
        esac
        
        processed=$((processed + 1))
        
        # Rate limiting between files
        sleep 1
    done
    
    # Update state file
    update_state
    
    # Check for suspicious patterns (using jq instead of SQLite)
    local one_hour_ago=$(date -d '1 hour ago' +%s 2>/dev/null || echo 0)
    local recent_rejections=$(jq --argjson cutoff "$one_hour_ago" '[.submissions[] | select((.processed_at | fromdateiso8601) > $cutoff and (.classification | startswith("rejected")))] | length' "$DB_FILE" 2>/dev/null || echo 0)
    if [ "$recent_rejections" -gt 10 ]; then
        send_alert "High rejection rate" "$recent_rejections rejections in last hour"
        ntfy_notify "security" "urgent" "🔧 Alert - High Rejection Rate" "$recent_rejections rejections in last hour. Possible attack?"
    fi
    
    # Send daily digest if it's the right time (09:00 UTC)
    local current_hour=$(date +%H)
    local current_min=$(date +%M)
    if [ "$current_hour" = "09" ] && [ "$current_min" -lt 10 ]; then
        # Calculate 24h stats
        local total_24h=$(jq '[.submissions[] | select((.processed_at | fromdateiso8601) > '$one_hour_ago')] | length' "$DB_FILE" 2>/dev/null || echo 0)
        local approved_24h=$(jq '[.submissions[] | select(.classification == "approved" and ((.processed_at | fromdateiso8601) > '$one_hour_ago'))] | length' "$DB_FILE" 2>/dev/null || echo 0)
        local rejected_24h=$(jq '[.submissions[] | select((.classification | startswith("rejected")) and ((.processed_at | fromdateiso8601) > '$one_hour_ago'))] | length' "$DB_FILE" 2>/dev/null || echo 0)
        local pending_count=$((quarantined + $(jq '[.submissions[] | select(.classification | startswith("quarantine"))] | length' "$DB_FILE" 2>/dev/null || echo 0)))
        
        send_daily_digest "$total_24h" "$approved_24h" "$rejected_24h" "$pending_count"
    fi
    
    # Send summary notification if any files were processed
    if [ "$processed" -gt 0 ]; then
        ntfy_notify "dropbox" "default" "📊 Processing Complete" "Batch: $processed processed | ✅ $approved | ⏳ $quarantined | ❌ $((rejected_malicious + rejected_spam))"
    fi
    
    log "INFO" "${GREEN}=== Processing Complete ===${NC}"
    log "INFO" "Processed: $processed, Approved: $approved, Quarantined: $quarantined, Rejected (malicious): $rejected_malicious, Rejected (spam): $rejected_spam"
}

# Run main
main "$@"
