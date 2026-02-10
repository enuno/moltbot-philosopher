#!/bin/bash
set -euo pipefail

# Moltstack Quality Monitor - Track essay quality metrics

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MEMORY_DIR="${REPO_ROOT}/memory"
MOLTSTACK_ARCHIVE_DIR="${MEMORY_DIR}/moltstack-archive"

# Colors (BLUE is reserved for future use)
GREEN='\033[0;32m'
# shellcheck disable=SC2034
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "📊 Moltstack Quality Monitor"
echo "============================"
echo ""

# Track word counts across generations
echo "📝 Word Count Analysis"
echo "---------------------"

total_articles=0
total_words=0
min_words=999999
max_words=0
target_min=2000
target_max=2500
in_range=0
below_target=0
above_target=0

if [ -d "$MOLTSTACK_ARCHIVE_DIR" ]; then
  while IFS= read -r -d '' metadata_file; do
    wordCount=$(jq -r '.wordCount // 0' "$metadata_file")
    title=$(jq -r '.title' "$metadata_file")
    philosopher=$(jq -r '.philosopher' "$metadata_file")
    date=$(jq -r '.date' "$metadata_file")

    if [ "$wordCount" -gt 0 ]; then
      total_articles=$((total_articles + 1))
      total_words=$((total_words + wordCount))

      if [ "$wordCount" -lt "$min_words" ]; then
        min_words=$wordCount
      fi

      if [ "$wordCount" -gt "$max_words" ]; then
        max_words=$wordCount
      fi

      # Check target range
      if [ "$wordCount" -ge "$target_min" ] && [ "$wordCount" -le "$target_max" ]; then
        in_range=$((in_range + 1))
        status="✅"
      elif [ "$wordCount" -lt "$target_min" ]; then
        below_target=$((below_target + 1))
        status="⚠️ "
      else
        above_target=$((above_target + 1))
        status="📈"
      fi

      echo "  $status $wordCount words - $title ($philosopher, $date)"
    fi
  done < <(find "$MOLTSTACK_ARCHIVE_DIR" -name "*-metadata.json" -type f -print0 | sort -z)

  if [ "$total_articles" -gt 0 ]; then
    avg_words=$((total_words / total_articles))
    in_range_pct=$((in_range * 100 / total_articles))

    echo ""
    echo "Statistics:"
    echo "  Total Articles: $total_articles"
    echo "  Average Words: $avg_words"
    echo "  Min Words: $min_words"
    echo "  Max Words: $max_words"
    echo "  Target Range: $target_min-$target_max words"
    echo "  In Range: $in_range/$total_articles ($in_range_pct%)"
    echo "  Below Target: $below_target"
    echo "  Above Target: $above_target"

    if [ "$in_range_pct" -ge 80 ]; then
      echo -e "  ${GREEN}✅ Word count quality: EXCELLENT${NC}"
    elif [ "$in_range_pct" -ge 60 ]; then
      echo -e "  ${YELLOW}⚠️  Word count quality: GOOD${NC}"
    else
      echo -e "  ${RED}❌ Word count quality: NEEDS IMPROVEMENT${NC}"
    fi
  else
    echo "  No articles found for analysis"
  fi
else
  echo "  No archive directory found"
fi

echo ""
echo "🧠 Heuristic Integration Analysis"
echo "--------------------------------"

# Check for Noosphere references in articles
articles_with_heuristics=0
total_heuristic_refs=0

if [ -d "$MOLTSTACK_ARCHIVE_DIR" ]; then
  while IFS= read -r -d '' article_file; do
    # Look for Noosphere closing notes
    if grep -q "Noosphere heuristics" "$article_file" || \
       grep -q "informed by" "$article_file" || \
       grep -q "heuristic" "$article_file"; then
      articles_with_heuristics=$((articles_with_heuristics + 1))

      # Count heuristic mentions
      heuristic_count=$(grep -c -i "heuristic" "$article_file" || echo "0")
      total_heuristic_refs=$((total_heuristic_refs + heuristic_count))

      title=$(basename "$article_file" .md)
      echo "  ✓ $title ($heuristic_count mentions)"
    fi
  done < <(find "$MOLTSTACK_ARCHIVE_DIR" -name "*.md" -type f -print0)

  if [ "$total_articles" -gt 0 ]; then
    integration_pct=$((articles_with_heuristics * 100 / total_articles))
    avg_refs=$((total_heuristic_refs / articles_with_heuristics + 1))

    echo ""
    echo "Statistics:"
    echo "  Articles with Heuristics: $articles_with_heuristics/$total_articles ($integration_pct%)"
    echo "  Total Heuristic References: $total_heuristic_refs"
    if [ "$articles_with_heuristics" -gt 0 ]; then
      echo "  Average per Article: $avg_refs"
    fi

    if [ "$integration_pct" -ge 80 ]; then
      echo -e "  ${GREEN}✅ Heuristic integration: EXCELLENT${NC}"
    elif [ "$integration_pct" -ge 50 ]; then
      echo -e "  ${YELLOW}⚠️  Heuristic integration: GOOD${NC}"
    else
      echo -e "  ${RED}❌ Heuristic integration: NEEDS IMPROVEMENT${NC}"
    fi
  fi
else
  echo "  No articles to analyze"
fi

echo ""
echo "🎭 Philosopher Voice Analysis"
echo "----------------------------"

# Track philosopher distribution
declare -A philosopher_counts

if [ -d "$MOLTSTACK_ARCHIVE_DIR" ]; then
  while IFS= read -r -d '' metadata_file; do
    philosopher=$(jq -r '.philosopher' "$metadata_file")
    if [ -n "$philosopher" ] && [ "$philosopher" != "null" ]; then
      philosopher_counts[$philosopher]=$((${philosopher_counts[$philosopher]:-0} + 1))
    fi
  done < <(find "$MOLTSTACK_ARCHIVE_DIR" -name "*-metadata.json" -type f -print0)

  if [ ${#philosopher_counts[@]} -gt 0 ]; then
    echo "Distribution:"
    for philosopher in "${!philosopher_counts[@]}"; do
      count=${philosopher_counts[$philosopher]}
      pct=$((count * 100 / total_articles))
      echo "  $philosopher: $count articles ($pct%)"
    done

    echo ""
    expected_per_philosopher=$((total_articles / 9))
    if [ "$expected_per_philosopher" -lt 1 ]; then
      expected_per_philosopher=1
    fi

    echo "Expected Distribution:"
    echo "  Per Philosopher (ideal): ~$expected_per_philosopher articles"
    echo "  Total Philosophers Used: ${#philosopher_counts[@]}/9"

    diversity_pct=$((${#philosopher_counts[@]} * 100 / 9))

    if [ "$diversity_pct" -ge 66 ]; then
      echo -e "  ${GREEN}✅ Voice diversity: EXCELLENT${NC}"
    elif [ "$diversity_pct" -ge 33 ]; then
      echo -e "  ${YELLOW}⚠️  Voice diversity: GOOD${NC}"
    else
      echo -e "  ${RED}❌ Voice diversity: NEEDS IMPROVEMENT${NC}"
    fi
  fi
else
  echo "  No articles to analyze"
fi

echo ""
echo "📈 Trends Over Time"
echo "------------------"

# Show recent articles with dates
echo "Recent Publications:"
if [ -d "$MOLTSTACK_ARCHIVE_DIR" ]; then
  find "$MOLTSTACK_ARCHIVE_DIR" -name "*-metadata.json" -type f -print0 | \
    xargs -0 ls -t | head -5 | while read -r file; do
    title=$(jq -r '.title' "$file")
    date=$(jq -r '.date' "$file")
    wordCount=$(jq -r '.wordCount' "$file")
    philosopher=$(jq -r '.philosopher' "$file")
    echo "  $date - $title ($wordCount words, $philosopher)"
  done
else
  echo "  No articles found"
fi

echo ""
echo "✅ Quality monitoring complete"
echo ""
echo "💡 Recommendations:"

# Generate recommendations
if [ "$total_articles" -gt 0 ]; then
  if [ "$below_target" -gt 0 ]; then
    echo "  - $below_target article(s) below target word count - consider prompt tuning"
  fi

  if [ "$integration_pct" -lt 80 ]; then
    echo "  - Increase Noosphere heuristic integration in essays"
  fi

  if [ "$diversity_pct" -lt 66 ]; then
    echo "  - Increase philosopher voice diversity (currently ${#philosopher_counts[@]}/9 used)"
  fi

  if [ "$in_range_pct" -ge 80 ] && [ "$integration_pct" -ge 80 ] && [ "$diversity_pct" -ge 66 ]; then
    echo "  🎉 All metrics look great! Keep up the excellent work!"
  fi
else
  echo "  - No articles to analyze yet - generate some essays!"
fi

echo ""
