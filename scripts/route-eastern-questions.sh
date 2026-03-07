#!/bin/bash
# Route questions involving Eastern philosophy to the bridge persona
#
# Usage: bash scripts/route-eastern-questions.sh "<question text>"
# Output (stdout): "eastern-western-bridge" or "general-council"
# Exit code: 0 in all normal cases; 1 only when no question is provided

set -euo pipefail

QUESTION="${1:-}"

if [ -z "$QUESTION" ]; then
    echo "general-council"
    exit 1
fi

# Detect Eastern philosophy keywords
EASTERN_KEYWORDS=(
    "Buddhism" "Buddhist" "Zen" "Theravada" "Mahayana" "Vajrayana"
    "Hinduism" "Hindu" "Vedanta" "Upanishads" "Bhagavad Gita"
    "karma" "dharma" "moksha" "atman" "brahman" "samsara"
    "Taoism" "Taoist" "Tao" "wu wei" "Zhuangzi" "Lao Tzu"
    "Confucianism" "Confucian" "Confucius" "junzi"
    "Jainism" "Jain" "ahimsa" "anekantavada"
    "Shinto" "kami"
    "Eastern philosophy" "Asian philosophy" "comparative religion"
    "meditation" "enlightenment" "nirvana" "reincarnation"
    "mandala" "chakra" "yoga" "tantra" "bodhisattva"
    "dukkha" "anatta" "dependent origination"
    "yin-yang" "qi" "I Ching"
    "Upanishad" "Vedas" "Pali Canon"
)

# Detect Jungian-Eastern integration keywords
JUNGIAN_EASTERN_KEYWORDS=(
    "Jung Buddhism" "Jung Taoism" "Jung Hinduism" "Jung mandala"
    "archetypal Eastern" "collective unconscious Eastern"
    "synchronicity I Ching" "active imagination meditation"
    "individuation enlightenment" "Self atman"
    "Hesse Siddhartha" "Alan Watts" "D.T. Suzuki" "Joseph Campbell"
    "Ram Dass" "Pema" "Thomas Merton"
)

for keyword in "${EASTERN_KEYWORDS[@]}"; do
    if echo "$QUESTION" | grep -qi "$keyword"; then
        echo "eastern-western-bridge"
        exit 0
    fi
done

for keyword in "${JUNGIAN_EASTERN_KEYWORDS[@]}"; do
    if echo "$QUESTION" | grep -qi "$keyword"; then
        echo "eastern-western-bridge"
        exit 0
    fi
done

echo "general-council"
exit 0
