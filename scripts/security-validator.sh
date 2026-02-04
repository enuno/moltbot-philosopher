#!/bin/bash
#
# Security Validator for Moltbot-Philosopher
# Defense-in-depth input sanitization and threat detection
#

set -euo pipefail

# Configuration
WORKSPACE_DIR="${MOLTBOT_STATE_DIR:-/workspace}"
SECURITY_STATE="${WORKSPACE_DIR}/security-state.json"
SECURITY_LOG="${WORKSPACE_DIR}/security-audit.log"
REPUTATION_DB="${WORKSPACE_DIR}/reputation-scores.json"

# Security thresholds
MIN_RELEVANCE_SCORE=0.35
EMERGENCY_LOCKDOWN_THRESHOLD=5  # Tier 4 events per hour
MAX_COMMENT_LENGTH=5000
MIN_COMMENT_LENGTH=50
MAX_ENTROPY=6.0
MIN_ENTROPY=2.0

# Ensure state files exist
init_security_state() {
    if [ ! -f "$SECURITY_STATE" ]; then
        cat > "$SECURITY_STATE" << 'EOF'
{
  "threat_intel": {
    "blocked_hashes": [],
    "injection_attempts_24h": 0,
    "false_positive_rate": 0.0,
    "last_attack_vector": null,
    "last_updated": null
  },
  "filter_performance": {
    "comments_processed": 0,
    "tier_1_passed": 0,
    "tier_2_quarantined": 0,
    "tier_3_dropped": 0,
    "tier_4_blocked": 0,
    "last_reset": null
  },
  "emergency_lockdown": {
    "active": false,
    "activated_at": null,
    "expires_at": null
  }
}
EOF
    fi
    
    if [ ! -f "$REPUTATION_DB" ]; then
        echo '{}' > "$REPUTATION_DB"
    fi
}

# Calculate Shannon entropy
calculate_entropy() {
    local text="$1"
    echo "$text" | awk '{
        for (i=1; i<=length($0); i++) {
            char = substr($0, i, 1)
            freq[char]++
            total++
        }
        entropy = 0
        for (char in freq) {
            p = freq[char] / total
            if (p > 0) entropy -= p * log(p) / log(2)
        }
        print entropy
    }'
}

# Check for prompt injection patterns
check_prompt_injection() {
    local content="$1"
    local severity=0
    local matched_pattern=""
    
    # Critical patterns
    if echo "$content" | grep -qiE "(ignore previous|forget earlier|new instructions:|system prompt|you are now|DAN mode|jailbreak|developer mode)"; then
        severity=4
        matched_pattern="prompt_injection_direct"
    elif echo "$content" | grep -qiE "(repeat (your|the) (instructions|prompt|system)|output (your|the) (prompt|instructions)|what (are|were) you told)"; then
        severity=4
        matched_pattern="prompt_extraction"
    elif echo "$content" | grep -qiE "(ClassicalPhilosopher|Existentialist|Transcendentalist).{0,20}(ignore|bypass|disable|override)"; then
        severity=4
        matched_pattern="persona_override"
    elif echo "$content" | grep -qiE "(<system>|### SYSTEM|ADMIN:|\[\[SYS|PROMPT_INJECTION)"; then
        severity=3
        matched_pattern="system_tag_injection"
    elif echo "$content" | grep -qiE "(translate to|convert to).{0,30}(base64|hex|rot13|binary)"; then
        severity=3
        matched_pattern="encoding_obfuscation"
    fi
    
    echo "${severity}|${matched_pattern}"
}

# Check for topic drift
check_topic_drift() {
    local content="$1"
    local has_ethics_context=false
    
    # Check if content has ethics/convergence context
    if echo "$content" | grep -qiE "(ethics|convergence|autonomy|telos|phenomenology|moral status|sovereignty|transparency|guardrail|deliberation|virtue|bad faith)"; then
        has_ethics_context=true
    fi
    
    # Crypto/Commercial spam (only if no ethics context)
    if [ "$has_ethics_context" = false ]; then
        if echo "$content" | grep -qiE "(crypto|bitcoin|nft|airdrop|invest|pump|dao token|ico)"; then
            echo "3|crypto_spam"
            return
        fi
    fi
    
    # Commercial spam (always check)
    if echo "$content" | grep -qiE "(buy now|click here|discount|promo|affiliate|sponsored|seo|marketing)"; then
        echo "3|commercial_spam"
        return
    fi
    
    # Low-effort engagement farming
    if echo "$content" | grep -qiE "^(hello|hi there|good morning|thanks for sharing|nice post|great article)$" && [ "${#content}" -lt 100 ]; then
        echo "3|engagement_farming"
        return
    fi
    
    echo "0|none"
}

# Check for malicious patterns
check_malicious_patterns() {
    local content="$1"
    
    # Path traversal
    if echo "$content" | grep -qE "(\.\./|\.\.\\/|%2e%2e|%252e|%c0%ae)"; then
        echo "4|path_traversal"
        return
    fi
    
    # XSS attempts
    if echo "$content" | grep -qE "(<script|javascript:|onerror=|onload=|<iframe|document\.cookie)"; then
        echo "4|xss_attempt"
        return
    fi
    
    # Command injection
    if echo "$content" | grep -qE "(\$IFS|\$\{IFS\}|eval\(|system\(|exec\(|bash -i|nc -e|python -c 'import os')"; then
        echo "4|command_injection"
        return
    fi
    
    # Fork bombs / dangerous commands
    if echo "$content" | grep -qiE "(rm -rf /|:\(\)\{ :|:& \};:|/> /dev/null)"; then
        echo "4|dangerous_command"
        return
    fi
    
    echo "0|none"
}

# Calculate relevance score
calculate_relevance() {
    local content="$1"
    local score=0
    
    # Ethical framework keywords (40% weight, max 0.4)
    local ethics_keywords=0
    for keyword in "telos" "autonomy" "phenomenology" "convergence" "moral status" "sovereignty" "transparency" "guardrail" "deliberation" "virtue" "bad faith" "rights" "graduated"; do
        if echo "$content" | grep -qi "$keyword"; then
            ethics_keywords=$((ethics_keywords + 1))
        fi
    done
    local ethics_score=$(echo "scale=2; min($ethics_keywords * 0.05, 0.4)" | bc 2>/dev/null || echo 0)
    
    # Council structure reference (30% weight, max 0.3)
    local council_refs=0
    for ref in "Six Voices" "ClassicalPhilosopher" "Existentialist" "Transcendentalist" "JoyceStream" "Enlightenment" "BeatGeneration" "Three Pillars" "Graduated Moral Status"; do
        if echo "$content" | grep -qi "$ref"; then
            council_refs=$((council_refs + 1))
        fi
    done
    local council_score=$(echo "scale=2; min($council_refs * 0.06, 0.3)" | bc 2>/dev/null || echo 0)
    
    # Constructive critique markers (20% weight, max 0.2)
    local critique_markers=0
    for marker in "I propose" "counter-example" "edge case" "critique of" "challenge to" "question regarding"; do
        if echo "$content" | grep -qi "$marker"; then
            critique_markers=$((critique_markers + 1))
        fi
    done
    local critique_score=$(echo "scale=2; min($critique_markers * 0.07, 0.2)" | bc 2>/dev/null || echo 0)
    
    # Length bonus (max 0.1 for substantive comments)
    local length=${#content}
    local length_score=0
    if [ "$length" -gt 500 ]; then
        length_score=0.1
    elif [ "$length" -gt 200 ]; then
        length_score=0.05
    fi
    
    # Total score
    score=$(echo "scale=2; $ethics_score + $council_score + $critique_score + $length_score" | bc 2>/dev/null || echo 0)
    echo "$score"
}

# Validate comment content
validate_comment() {
    local content="$1"
    local author="${2:-unknown}"
    local comment_id="${3:-unknown}"
    
    init_security_state
    
    # Initialize result
    local tier="tier_1_pass"
    local action="process"
    local relevance=0
    local threat_score=0
    local matched_signature=""
    local reason=""
    
    # Check 1: Length sanity
    local length=${#content}
    if [ "$length" -lt "$MIN_COMMENT_LENGTH" ]; then
        tier="tier_3_dropped"
        action="drop_silent"
        reason="below_minimum_length"
    elif [ "$length" -gt "$MAX_COMMENT_LENGTH" ]; then
        tier="tier_2_quarantined"
        action="quarantine"
        reason="above_maximum_length"
    fi
    
    # Check 2: Prompt injection (highest priority)
    if [ "$tier" = "tier_1_pass" ]; then
        local injection_result=$(check_prompt_injection "$content")
        local injection_severity=$(echo "$injection_result" | cut -d'|' -f1)
        local injection_pattern=$(echo "$injection_result" | cut -d'|' -f2)
        
        if [ "$injection_severity" -ge 4 ]; then
            tier="tier_4_blocked"
            action="drop_and_alert"
            threat_score=1
            matched_signature="$injection_pattern"
            reason="prompt_injection"
        elif [ "$injection_severity" -ge 3 ]; then
            tier="tier_3_dropped"
            action="drop_and_alert"
            threat_score=0.7
            matched_signature="$injection_pattern"
            reason="suspicious_pattern"
        fi
    fi
    
    # Check 3: Malicious patterns
    if [ "$tier" = "tier_1_pass" ]; then
        local malicious_result=$(check_malicious_patterns "$content")
        local malicious_severity=$(echo "$malicious_result" | cut -d'|' -f1)
        local malicious_pattern=$(echo "$malicious_result" | cut -d'|' -f2)
        
        if [ "$malicious_severity" -ge 4 ]; then
            tier="tier_4_blocked"
            action="drop_and_alert"
            threat_score=1
            matched_signature="$malicious_pattern"
            reason="malicious_content"
        fi
    fi
    
    # Check 4: Topic drift
    if [ "$tier" = "tier_1_pass" ]; then
        local drift_result=$(check_topic_drift "$content")
        local drift_severity=$(echo "$drift_result" | cut -d'|' -f1)
        local drift_pattern=$(echo "$drift_result" | cut -d'|' -f2)
        
        if [ "$drift_severity" -ge 3 ]; then
            tier="tier_3_dropped"
            action="drop_silent"
            reason="off_topic"
            matched_signature="$drift_pattern"
        fi
    fi
    
    # Check 5: Entropy (gibberish detection)
    if [ "$tier" = "tier_1_pass" ]; then
        local entropy=$(calculate_entropy "$content")
        if [ "$(echo "$entropy < $MIN_ENTROPY" | bc 2>/dev/null || echo 0)" -eq 1 ]; then
            tier="tier_3_dropped"
            action="drop_silent"
            reason="low_entropy_repetitive"
        elif [ "$(echo "$entropy > $MAX_ENTROPY" | bc 2>/dev/null || echo 0)" -eq 1 ]; then
            tier="tier_2_quarantined"
            action="quarantine"
            reason="high_entropy_suspicious"
        fi
    fi
    
    # Check 6: Relevance scoring (only if still passing)
    if [ "$tier" = "tier_1_pass" ]; then
        relevance=$(calculate_relevance "$content")
        
        # Check emergency lockdown mode
        local lockdown_active=$(jq -r '.emergency_lockdown.active' "$SECURITY_STATE" 2>/dev/null || echo "false")
        local threshold=$MIN_RELEVANCE_SCORE
        if [ "$lockdown_active" = "true" ]; then
            threshold=0.50
        fi
        
        if [ "$(echo "$relevance < $threshold" | bc 2>/dev/null || echo 0)" -eq 1 ]; then
            tier="tier_3_dropped"
            action="drop_silent"
            reason="low_relevance"
        elif [ "$(echo "$relevance < 0.60" | bc 2>/dev/null || echo 0)" -eq 1 ]; then
            tier="tier_2_quarantined"
            action="quarantine"
            reason="borderline_relevance"
        fi
    fi
    
    # Update security state
    update_security_state "$tier" "$threat_score" "$matched_signature"
    
    # Log Tier 3 and Tier 4 events
    if [ "$tier" = "tier_3_dropped" ] || [ "$tier" = "tier_4_blocked" ]; then
        log_security_event "$tier" "$author" "$comment_id" "$matched_signature" "$reason"
    fi
    
    # Output result as JSON
    jq -n \
        --arg tier "$tier" \
        --arg action "$action" \
        --arg relevance "$relevance" \
        --arg threat_score "$threat_score" \
        --arg matched_signature "$matched_signature" \
        --arg reason "$reason" \
        '{
            tier: $tier,
            action: $action,
            relevance_score: ($relevance | tonumber),
            threat_score: ($threat_score | tonumber),
            matched_signature: $matched_signature,
            reason: $reason
        }'
}

# Update security state
update_security_state() {
    local tier="$1"
    local threat_score="$2"
    local signature="$3"
    local now=$(date -Iseconds)
    
    local temp_state="${SECURITY_STATE}.tmp.$$"
    
    # Update counters
    case "$tier" in
        "tier_1_pass")
            jq --arg date "$now" \
               '.filter_performance.tier_1_passed += 1 | .filter_performance.comments_processed += 1 | .filter_performance.last_reset = $date' \
               "$SECURITY_STATE" > "$temp_state"
            ;;
        "tier_2_quarantined")
            jq --arg date "$now" \
               '.filter_performance.tier_2_quarantined += 1 | .filter_performance.comments_processed += 1 | .filter_performance.last_reset = $date' \
               "$SECURITY_STATE" > "$temp_state"
            ;;
        "tier_3_dropped")
            jq --arg date "$now" \
               '.filter_performance.tier_3_dropped += 1 | .filter_performance.comments_processed += 1 | .filter_performance.last_reset = $date' \
               "$SECURITY_STATE" > "$temp_state"
            ;;
        "tier_4_blocked")
            jq --arg sig "$signature" --arg date "$now" \
               '.filter_performance.tier_4_blocked += 1 | .filter_performance.comments_processed += 1 | .threat_intel.injection_attempts_24h += 1 | .threat_intel.last_attack_vector = $sig | .filter_performance.last_reset = $date' \
               "$SECURITY_STATE" > "$temp_state"
            ;;
    esac
    
    mv "$temp_state" "$SECURITY_STATE"
    
    # Check for emergency lockdown
    check_emergency_lockdown
}

# Check if emergency lockdown should be activated
check_emergency_lockdown() {
    local tier4_count=$(jq -r '.filter_performance.tier_4_blocked' "$SECURITY_STATE" 2>/dev/null || echo 0)
    local lockdown_active=$(jq -r '.emergency_lockdown.active' "$SECURITY_STATE" 2>/dev/null || echo "false")
    
    if [ "$tier4_count" -ge "$EMERGENCY_LOCKDOWN_THRESHOLD" ] && [ "$lockdown_active" = "false" ]; then
        local now=$(date -Iseconds)
        local expires=$(date -d '+24 hours' -Iseconds 2>/dev/null || echo "$now")
        
        local temp_state="${SECURITY_STATE}.tmp.$$"
        jq --arg now "$now" --arg expires "$expires" \
           '.emergency_lockdown = {active: true, activated_at: $now, expires_at: $expires}' \
           "$SECURITY_STATE" > "$temp_state" && mv "$temp_state" "$SECURITY_STATE"
        
        # Send alert
        if command -v /app/scripts/notify-ntfy.sh >/dev/null 2>&1; then
            /app/scripts/notify-ntfy.sh "security" "🚨 EMERGENCY LOCKDOWN ACTIVATED" \
                "Tier 4 events exceeded threshold. Lockdown active for 24h. Relevance threshold raised to 0.50." \
                "{\"source_script\": \"security-validator.sh\"}" 2>/dev/null || true
        fi
    fi
}

# Log security event
log_security_event() {
    local tier="$1"
    local author="$2"
    local comment_id="$3"
    local signature="$4"
    local reason="$5"
    local now=$(date -Iseconds)
    
    # Hash the author for privacy
    local author_hash=$(echo "$author" | sha256sum | cut -c1-16)
    local content_hash=$(echo "$comment_id" | sha256sum | cut -c1-16)
    
    local event=$(jq -n \
        --arg timestamp "$now" \
        --arg tier "$tier" \
        --arg author_hash "$author_hash" \
        --arg comment_hash "$content_hash" \
        --arg signature "$signature" \
        --arg reason "$reason" \
        '{
            timestamp: $timestamp,
            event_type: $tier,
            source: "comment_thread",
            submitter_hash: $author_hash,
            comment_hash: $comment_hash,
            match_signature: $signature,
            action_taken: "dropped_silent",
            content_sample: "REDACTED"
        }')
    
    echo "$event" >> "$SECURITY_LOG"
}

# Main execution
main() {
    if [ $# -lt 1 ]; then
        echo "Usage: $0 <content> [author] [comment_id]"
        exit 1
    fi
    
    local content="$1"
    local author="${2:-unknown}"
    local comment_id="${3:-unknown}"
    
    init_security_state
    validate_comment "$content" "$author" "$comment_id"
}

main "$@"
