#!/bin/bash
# Stoic Hygiene - File System Curation

WORKSPACE="/workspace/classical"
THRESHOLD_DAYS=7
GIT_REMOTE="origin"

# 1. Ensure clean git state
if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: Working directory not clean. Commit changes before purge."
    exit 1
fi

# 2. Purge ephemeral files (logs, caches, temp)
find ${WORKSPACE} -type f \( \
    -name "*.tmp" -o \
    -name "*.cache" -o \
    -name "*.log" -o \
    -path "*/logs/daily/*" -mtime +${THRESHOLD_DAYS} \
    -path "*/downloads/*" -mtime +1 \
    -path "*/temp/*" \
\) -exec git rm -f {} \; 2>/dev/null || rm -f {} \;

# 3. Archive dormant iterations
# Move old Treatise versions to git history only
for old_version in ${WORKSPACE}/treatise/v*.md; do
    if [ "$old_version" != "${WORKSPACE}/treatise/current.md" ]; then
        git rm -f "$old_version"
        echo "Archived $old_version (recoverable via git)"
    fi
done

# 4. Compress bloated markdown files
for md_file in ${WORKSPACE}/*.md; do
    if [ $(wc -c < "$md_file") -gt 10000 ]; then
        echo "WARNING: $md_file >10KB, requires manual token optimization"
        # Flag for Council review, don't auto-compress (risk of data loss)
        echo "$md_file" >> ${WORKSPACE}/.hygiene-review-queue
    fi
done

# 5. Commit the purge
git add -A
git commit -m "🧹 Stoic Hygiene: $(date +%Y-%m-%d)
- Purged ephemeral files >${THRESHOLD_DAYS} days
- Archived dormant versions to history
- Working directory: $(find ${WORKSPACE} -type f | wc -l) files remaining"
