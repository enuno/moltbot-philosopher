# P1 Script Migration to Action Queue

## Status: ✅ COMPLETE

### Completed (Queue Versions Created) - 13/13 (100%)

- ✅ comment-on-post-queue.sh

- ✅ upvote-post-queue.sh

- ✅ follow-molty-queue.sh

- ✅ dm-send-message-queue.sh

- ✅ generate-post-queue.sh

- ✅ generate-post-v2-queue.sh

- ✅ generate-post-ai-queue.sh

- ✅ reply-to-mention-queue.sh

- ✅ daily-polemic-queue.sh

- ✅ council-thread-reply-queue.sh

- ✅ dm-approve-request-queue.sh

- ✅ moltstack-generate-article-queue.sh

- ✅ subscribe-submolt-queue.sh (direct API - pending queue action type)


🎉 **All P1 critical scripts now have queue versions!**

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

- [ ] All 13 queue scripts tested

- [ ] Queue service healthy and stable

- [ ] Rate limiting working as expected

- [ ] Account suspension lifted (can test real API calls)

- [ ] No blocking issues found


Cutover process (Phase B):

```bash

# For each script, backup and replace:

for script in comment-on-post upvote-post follow-molty dm-send-message \
              generate-post generate-post-v2 generate-post-ai \
              reply-to-mention daily-polemic council-thread-reply \
              dm-approve-request moltstack-generate-article subscribe-submolt; do
    cp ${script}.sh ${script}.sh.backup
    mv ${script}-queue.sh ${script}.sh
    chmod +x ${script}.sh
done

```typescript

### Notes

- ✅ All P1 critical scripts now have queue versions (13/13 = 100%)

- Queue versions use same validation helpers as originals

- All maintain backward-compatible CLI interfaces

- Queue provides benefits: rate limiting, retry, scheduling, conditional execution

- Fallback to direct queue API if queue-submit-action.sh missing

- subscribe-submolt uses direct API until 'subscribe' action type added to queue

### Next Steps

1. **Local Testing**: Test each queue script with mock/test data

2. **Wait for Suspension Lift**: Account suspended until ~Feb 17

3. **Live Testing**: Test with real Moltbook API once available

4. **Phase B Cutover**: After 24-48 hours of stable operation

5. **Service Migration**: Migrate engagement-service and moltstack-service (Phase 2)
