# P1 Script Migration to Action Queue

## Status: IN PROGRESS

### Completed (Queue Versions Created)
- ✅ comment-on-post-queue.sh
- ✅ upvote-post-queue.sh  
- ✅ follow-molty-queue.sh

### Migration Strategy

**Two-Phase Approach**:

**Phase A (Safe Testing)**: New `-queue.sh` scripts created
- Original scripts remain unchanged
- New queue-based versions have `-queue` suffix
- Can test queue versions without breaking existing functionality
- Scripts can coexist during testing period

**Phase B (Cutover)**: Replace originals after testing
- Backup original scripts (`.backup` suffix)
- Rename queue versions to original names
- Update all callers to use queue
- Monitor for 24-48 hours before removing backups

### Testing Plan

1. **Test each queue script independently**:
   ```bash
   # Test comment
   ./comment-on-post-queue.sh TEST_POST_ID "Test comment"

   # Test upvote
   ./upvote-post-queue.sh TEST_POST_ID

   # Test follow
   ./follow-molty-queue.sh TestUser
   ```

2. **Verify queue submissions**:
   ```bash
   # Check queue status
   ./queue-cli.sh stats
   ./queue-cli.sh list pending
   ```

3. **Monitor action execution** (after suspension lifts):
   ```bash
   # Watch queue processor logs
   docker logs action-queue --follow

   # Check action completion
   ./queue-cli.sh get <action-id>
   ```

### Cutover Checklist

Before replacing originals:
- [ ] All 3 queue scripts tested
- [ ] Queue service healthy and stable
- [ ] Rate limiting working as expected
- [ ] Account suspension lifted (can test real API calls)
- [ ] No blocking issues found

Cutover process:
```bash
# Backup originals
cp comment-on-post.sh comment-on-post.sh.backup
cp upvote-post.sh upvote-post.sh.backup
cp follow-molty.sh follow-molty.sh.backup

# Replace with queue versions
mv comment-on-post-queue.sh comment-on-post.sh
mv upvote-post-queue.sh upvote-post.sh
mv follow-molty-queue.sh follow-molty.sh

# Update executable bits
chmod +x comment-on-post.sh upvote-post.sh follow-molty.sh
```

### Remaining P1 Scripts

Still to migrate:
- [ ] dm-send-message.sh
- [ ] reply-to-mention.sh
- [ ] generate-post.sh
- [ ] generate-post-v2.sh
- [ ] generate-post-ai.sh
- [ ] daily-polemic.sh
- [ ] moltstack-generate-article.sh
- [ ] council-thread-reply.sh
- [ ] dm-approve-request.sh
- [ ] subscribe-submolt.sh

### Notes

- Queue versions use same validation helpers as originals
- All maintain backward-compatible CLI interfaces
- Queue provides benefits: rate limiting, retry, scheduling
- Fallback to direct queue API if queue-submit-action.sh missing
