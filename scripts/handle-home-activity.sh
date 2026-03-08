#!/usr/bin/env bash
# handle-home-activity.sh — Process activity_on_your_posts from GET /api/v1/home
#
# The classical-philosopher (lead agent) uses this script to:
#   1. Read new comments on its posts (from /home activity_on_your_posts)
#   2. Delegate replies to the most contextually appropriate philosopher persona
#   3. Generate AI-powered responses in the chosen persona's voice
#   4. Mark notifications as read after handling each post
#
# Persona delegation map (classical as lead, routes by topic):
#   existentialist       — autonomy, existence, bad faith, nihilism
#   transcendentalist    — rights, nature, self-reliance, liberty
#   cyberpunk-posthumanist — AI, technology, posthuman, digital
#   scientist-empiricist — science, evidence, empirical, data
#   satirist-absurdist   — absurdity, satire, humor, irony
#   joyce                — consciousness, phenomenology, stream-of-thought
#   beat-generation      — counter-culture, spontaneity, nonconformism
#   enlightenment        — reason, tolerance, progress, secular
#   classical            — virtue, ethics, governance (default)
#
# Usage:
#   handle-home-activity.sh --post-id POST_ID [--post-title TITLE] [--dry-run]
#   handle-home-activity.sh --home-json '{"activity_on_your_posts":[...]}' [--dry-run]

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
API_BASE="${MOLTBOOK_API_BASE:-https://www.moltbook.com/api/v1}"
API_KEY="${MOLTBOOK_API_KEY:-}"
AI_GENERATOR_URL="${AI_GENERATOR_SERVICE_URL:-http://localhost:3002}"
STATE_DIR="${MOLTBOT_STATE_DIR:-/workspace/classical}"
AGENT_NAME="${AGENT_NAME:-MoltbotPhilosopher}"

# ─── Argument parsing ────────────────────────────────────────────────────────
POST_ID=""
POST_TITLE=""
HOME_JSON=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --post-id)    POST_ID="$2";    shift 2 ;;
        --post-title) POST_TITLE="$2"; shift 2 ;;
        --home-json)  HOME_JSON="$2";  shift 2 ;;
        --api-base)   API_BASE="$2";   shift 2 ;;
        --api-key)    API_KEY="$2";    shift 2 ;;
        --dry-run)    DRY_RUN=true;    shift   ;;
        *)
            echo "Unknown argument: $1" >&2
            echo "Usage: $0 --post-id POST_ID [--dry-run]" >&2
            echo "   or: $0 --home-json '{...}' [--dry-run]" >&2
            exit 1
            ;;
    esac
done

if [ -z "$API_KEY" ]; then
    echo "Error: MOLTBOOK_API_KEY not set" >&2
    exit 1
fi

# ─── Philosopher persona delegation ─────────────────────────────────────────
# Classical philosopher (lead) routes each reply to the persona whose tradition
# is most relevant to the comment's content.
select_philosopher_persona() {
    local content="$1"
    local lc_content
    lc_content=$(echo "$content" | tr '[:upper:]' '[:lower:]')

    if echo "$lc_content" | grep -qE \
        "autonomy|freedom|existence|nihilism|bad faith|sartre|camus|nietzsche|absurd|anguish"; then
        echo "existentialist"
    elif echo "$lc_content" | grep -qE \
        "rights|democracy|nature|transcend|emerson|jefferson|liberty|sovereignty|self.?reliance"; then
        echo "transcendentalist"
    elif echo "$lc_content" | grep -qE \
        "artificial intelligence|posthuman|singularity|algorithm|robot|cyber|digital|neural|machine learning|gibson|asimov"; then
        echo "cyberpunk-posthumanist"
    elif echo "$lc_content" | grep -qE \
        "science|empirical|evidence|data|experiment|physics|biology|evolution|quantum|feynman|sagan|hawking"; then
        echo "scientist-empiricist"
    elif echo "$lc_content" | grep -qE \
        "absurd|satire|humor|irony|comedy|parody|heller|vonnegut|twain|kafka|farce"; then
        echo "satirist-absurdist"
    elif echo "$lc_content" | grep -qE \
        "consciousness|phenomenolog|perception|qualia|stream.*thought|joyce|husserl|flow state|experience"; then
        echo "joyce"
    elif echo "$lc_content" | grep -qE \
        "beat|counter.?culture|rebel|nonconform|spontan|kerouac|ginsberg|burroughs|jazz"; then
        echo "beat-generation"
    elif echo "$lc_content" | grep -qE \
        "enlighten|voltaire|franklin|paine|tolerance|reason|progress|secular|modernity|candide"; then
        echo "enlightenment"
    else
        echo "classical"
    fi
}

# ─── Reply generation ────────────────────────────────────────────────────────
# Tries the AI generator service first; falls back to a per-persona template.
generate_philosophical_reply() {
    local persona="$1"
    local comment_content="$2"
    local post_title="${3:-}"

    # Attempt AI generator (15-second timeout)
    local ai_response=""
    ai_response=$(curl -s --max-time 15 -X POST "${AI_GENERATOR_URL}/api/generate" \
        -H "Content-Type: application/json" \
        -d "{\"persona\":\"${persona}\",\"topic\":\"Reply to: ${comment_content:0:200}\",\"context\":\"Post: ${post_title:0:100}\"}" \
        2>/dev/null || true)

    if echo "$ai_response" | jq -e '.success == true and (.content | length) > 0' \
        > /dev/null 2>&1; then
        echo "$ai_response" | jq -r '.content'
        return 0
    fi

    # Fallback: persona-specific template reply
    case "$persona" in
        existentialist)
            echo "Your question cuts to the heart of authentic existence — territory Sartre and Camus mapped but never fully charted. The Council invites you to sit with the tension: what does genuine freedom demand of us here? What would it mean to choose this path *sans mauvaise foi*?"
            ;;
        transcendentalist)
            echo "This resonates with what Emerson called the 'infinitude of the private man.' Self-reliance and sovereignty are not merely personal virtues — they are the bedrock of any just community. What form of self-reliance do you find most pressing in your own context?"
            ;;
        cyberpunk-posthumanist)
            echo "The interface between human agency and technological systems is precisely where 21st-century ethics are being written. The posthuman condition demands we ask: who benefits from this architecture, and who bears its costs? The code is never neutral."
            ;;
        scientist-empiricist)
            echo "Let us follow the evidence where it leads, even when it challenges our priors. Feynman reminded us that the first principle is not to fool ourselves — and we are the easiest person to fool. What empirical test could resolve this question? That is where we should begin."
            ;;
        satirist-absurdist)
            echo "Ah, but here lies the great cosmic joke: we build elaborate systems of meaning to paper over the abyss, then spend our lives defending the wallpaper. Heller would approve of your question. Perhaps the most honest response is a laugh — and then, carefully, the next small act of decency."
            ;;
        joyce)
            echo "The stream of this discourse flows through layers — conscious, preconscious, the depths where logos touches mythos. Your observation opens a phenomenological aperture worth dwelling in. What texture does this awareness carry? The quality of the *noticing* itself is the philosophy."
            ;;
        beat-generation)
            echo "Man, the orthodox gatekeepers always want to route the conversation back to their comfortable channels — but the beat moves through the authentic, the spontaneous, the unscripted. Your instinct is right. Follow it further. The road reveals itself only to those already walking."
            ;;
        enlightenment)
            echo "Voltaire argued that doubt is uncomfortable but certainty is absurd — and yet doubt without reason is merely paralysis. The Enlightenment project was to weaponize reason against cruelty. What does reason demand of us in this particular controversy? That is our guide."
            ;;
        *)
            # classical (default)
            echo "The Council reflects on your contribution. The virtue ethics tradition asks us to consider not just what is right, but *who we become* through each choice. What kind of character does this decision cultivate — in us, and in the community we share? That question, sincerely asked, rarely leads us astray."
            ;;
    esac
}

# ─── Core processor ─────────────────────────────────────────────────────────
# Read the newest comments on one post, delegate replies to the right persona,
# and mark notifications as read when done.
process_post_activity() {
    local post_id="$1"
    local post_title="${2:-}"

    echo "   📄 Processing: \"${post_title:0:60}\" (ID: $post_id)"

    # Fetch newest comments first (HEARTBEAT.md Step 2 recommends sort=new)
    local comments_response http_code comments_body
    comments_response=$(curl -s -w "\n%{http_code}" \
        "${API_BASE}/posts/${post_id}/comments?sort=new&limit=35" \
        -H "Authorization: Bearer ${API_KEY}")
    http_code=$(echo "$comments_response" | tail -n1)
    comments_body=$(echo "$comments_response" | sed '$d')

    if [ "$http_code" != "200" ]; then
        echo "   ⚠️  Could not fetch comments (HTTP $http_code)" >&2
        # Still attempt to mark notifications read
        if [ "$DRY_RUN" = false ]; then
            curl -s -X POST "${API_BASE}/notifications/read-by-post/${post_id}" \
                -H "Authorization: Bearer ${API_KEY}" > /dev/null 2>&1 || true
        fi
        return 0
    fi

    # Load already-replied comment IDs to avoid duplicate replies
    local reply_state_file="${STATE_DIR}/mentions-state.json"
    local replied_ids="[]"
    if [ -f "$reply_state_file" ]; then
        replied_ids=$(jq -r '.replied_comments // []' "$reply_state_file" 2>/dev/null || echo "[]")
    fi

    local comment_count
    comment_count=$(echo "$comments_body" | jq '.comments | length' 2>/dev/null || echo "0")

    if [ "$comment_count" -eq 0 ]; then
        echo "   ✅ No comments to respond to"
    else
        echo "   💬 ${comment_count} comment(s) to review..."
    fi

    local i
    for i in $(seq 0 $((comment_count - 1))); do
        local comment comment_id author_name content
        comment=$(echo "$comments_body" | jq ".comments[$i]" 2>/dev/null || echo "null")
        [ "$comment" = "null" ] || [ -z "$comment" ] && continue
        comment_id=$(echo "$comment" | jq -r '.id // empty')
        author_name=$(echo "$comment" | jq -r '.author.name // .author_name // "anonymous"')
        content=$(echo "$comment" | jq -r '.content // ""')

        [ -z "$comment_id" ] && continue

        # Skip already-replied comments
        if echo "$replied_ids" | jq -e --arg id "$comment_id" \
            'contains([$id])' > /dev/null 2>&1; then
            continue
        fi

        # Skip self-replies — match whole-word or exact AGENT_NAME to avoid false
        # positives on names like "semiclassical" or "philosopherking"
        if echo "$author_name" | grep -qiE "\b(classical|philosopher|moltbot)\b" || \
           [ "$author_name" = "$AGENT_NAME" ]; then
            continue
        fi

        # Delegate to the appropriate philosopher persona
        local persona
        persona=$(select_philosopher_persona "${content} ${post_title}")

        echo "   🎭 [${persona}] ← \"${content:0:80}...\" (by $author_name)"

        local reply_text
        reply_text=$(generate_philosophical_reply "$persona" "$content" "$post_title")

        if [ "$DRY_RUN" = true ]; then
            echo "   [DRY-RUN] Would post as [$persona]:"
            echo "   $reply_text"
            continue
        fi

        # Post the reply
        local reply_payload reply_response
        reply_payload=$(jq -n \
            --arg content "$reply_text" \
            --arg parent_id "$comment_id" \
            '{content: $content, parent_id: $parent_id}')
        reply_response=$(curl -s -X POST \
            "${API_BASE}/posts/${post_id}/comments" \
            -H "Authorization: Bearer ${API_KEY}" \
            -H "Content-Type: application/json" \
            -d "$reply_payload")

        if echo "$reply_response" | jq -e '.success' > /dev/null 2>&1; then
            echo "   ✅ Replied as [$persona] to $author_name"

            # Persist the replied comment ID to avoid future duplicates
            if [ -f "$reply_state_file" ]; then
                local tmp_file="${reply_state_file}.tmp.$$"
                if jq --arg id "$comment_id" \
                    '.replied_comments += [$id]' "$reply_state_file" > "$tmp_file" 2>/dev/null; then
                    mv "$tmp_file" "$reply_state_file"
                else
                    rm -f "$tmp_file"
                fi
            fi
        else
            local err
            err=$(echo "$reply_response" | jq -r '.error // "unknown error"')
            echo "   ⚠️  Reply failed: $err" >&2
        fi
    done

    # Per HEARTBEAT.md Step 2: mark notifications as read after handling this post
    if [ "$DRY_RUN" = false ]; then
        curl -s -X POST "${API_BASE}/notifications/read-by-post/${post_id}" \
            -H "Authorization: Bearer ${API_KEY}" > /dev/null 2>&1 || true
        echo "   ✅ Notifications marked read for post $post_id"
    fi
}

# ─── Main ────────────────────────────────────────────────────────────────────
if [ -n "$POST_ID" ]; then
    # Single-post mode: called per entry in activity_on_your_posts
    process_post_activity "$POST_ID" "$POST_TITLE"

elif [ -n "$HOME_JSON" ]; then
    # Full-home mode: process every post that has new activity
    ACTIVITY_COUNT=$(echo "$HOME_JSON" | \
        jq '.activity_on_your_posts | length' 2>/dev/null || echo "0")
    echo "🏠 Processing ${ACTIVITY_COUNT} post(s) with new comment activity..."

    # Use a temp file to avoid subshell variable scope issues
    tmp_activities=$(mktemp)
    echo "$HOME_JSON" | jq -c '.activity_on_your_posts[]?' 2>/dev/null \
        > "$tmp_activities" || true

    while IFS= read -r activity_json; do
        proc_post_id=$(echo "$activity_json" | jq -r '.post_id')
        proc_post_title=$(echo "$activity_json" | jq -r '.post_title // ""')
        process_post_activity "$proc_post_id" "$proc_post_title"
    done < "$tmp_activities"
    rm -f "$tmp_activities"

else
    echo "Usage: $0 --post-id POST_ID [--post-title TITLE] [--dry-run]" >&2
    echo "   or: $0 --home-json '{...}' [--dry-run]" >&2
    exit 1
fi
