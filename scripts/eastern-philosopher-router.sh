#!/bin/bash
# Eastern Philosopher Question Router
#
# Routes questions to the eastern-philosopher persona when they contain
# Eastern-philosophy-specific concepts or explicitly ask for the Eastern
# perspective. Returns the persona name to use, or empty string if no match.
#
# Usage:
#   bash scripts/eastern-philosopher-router.sh "your question text here"
#   result=$(bash scripts/eastern-philosopher-router.sh "$question")
#   [ "$result" = "eastern" ] && echo "Route to Eastern Philosopher"
#
# Exit codes:
#   0 - success; writes persona name to stdout if matched, empty if not
#   1 - invalid usage (e.g., missing question argument)

set -euo pipefail

# --- Configuration -----------------------------------------------------------
# Keywords that signal an Eastern-philosophy question when no explicit persona
# is requested. Terms are checked case-insensitively.
EASTERN_KEYWORDS=(
    # Madhyamaka / Nagarjuna
    "sunyata" "svabhava" "shunyata" "emptiness"
    "dependent origination" "pratityasamutpada" "madhyamaka"
    "nagarjuna" "two truths" "tetralemma" "catuskoti"
    "mulamadhyamakakarika" "mmk"
    # Advaita Vedanta / Shankara
    "brahman" "atman" "maya" "advaita" "vedanta" "shankara" "shankaracharya"
    "tat tvam asi" "moksha" "adhyasa" "viveka" "saksin"
    # Taoism / Laozi / Zhuangzi
    "tao" "dao" "wu wei" "wu-wei" "laozi" "lao tzu" "lao-tzu"
    "zhuangzi" "chuang tzu" "zhuang zhou" "taoist" "taoism" "daoist"
    "pu" "uncarved block" "butterfly dream"
    # Zen / Dogen
    "dogen" "shikantaza" "uji" "being-time" "soto zen" "zazen"
    "genjokoan" "shobogenzo" "busho" "shusho-itto" "just sitting"
    # Sufism / Rumi
    "rumi" "sufi" "sufism" "fana" "baqa" "ishq" "tawhid"
    "masnavi" "mathnawi" "divan" "jalal"
    # Confucianism
    "confucius" "confucian" "confucianism" "analects" "lunyu"
    "junzi" "zhengming" "rectification of names"
    "filial piety" "xiao" "five relationships"
    # Buddhism general
    "bodhisattva" "dharma" "nirvana" "anicca" "impermanence"
    "karuna" "compassion" "prajna" "bodhi" "anatman" "no-self"
    # Explicit request patterns
    "eastern philosophy" "eastern tradition" "eastern perspective"
    "eastern sage" "non-western" "asian philosophy"
    "hindu philosophy" "buddhist philosophy" "taoist philosophy"
    "zen buddhism" "mahayana" "theravada"
    "upanishad" "bhagavad gita" "tao te ching"
)

# --- Functions ----------------------------------------------------------------

# Normalize text for matching: lowercase, collapse whitespace
normalize() {
    printf '%s\n' "$1" | tr '[:upper:]' '[:lower:]' | tr -s ' \t\n' ' '
}

# Check if keyword should use word-boundary matching (short keywords < 4 chars)
use_word_boundary() {
    local keyword=$1
    [ ${#keyword} -lt 4 ]
}

# Check if the normalized question matches any Eastern keyword
matches_eastern_keyword() {
    local question_norm
    question_norm=$(normalize "$1")
    local keyword
    for keyword in "${EASTERN_KEYWORDS[@]}"; do
        if use_word_boundary "$keyword"; then
            # For short keywords, use word boundary matching
            # Escape regex metacharacters and match as whole word
            local escaped_keyword
            escaped_keyword=$(printf '%s\n' "$keyword" | sed 's/[[\.*^$/]/\\&/g')
            if echo "$question_norm" | grep -qEw "$escaped_keyword"; then
                return 0
            fi
        else
            # For longer keywords, substring match is safe
            if echo "$question_norm" | grep -qF "$keyword"; then
                return 0
            fi
        fi
    done
    return 1
}

# --- Main entry point ---------------------------------------------------------

main() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <question-text>" >&2
        exit 1
    fi

    local question="$*"

    if matches_eastern_keyword "$question"; then
        echo "eastern"
    else
        echo ""
    fi
}

main "$@"
