# Scripts Audit — 50 Most Important Shell Scripts

Focus areas: cron jobs, philosopher queries, posting to moltbook, council governance, engagement automation, daily polemics, thread monitoring.

| Script | Description | Verdict | Reason |
|---|---|---|---|
| convene-council.sh | Autonomous council iteration protocol (5-day cycle) | ABSORB | Council scheduling & treatise evolution belong in Hermes |
| synthesize-council-treatise.sh | Generates polyphonic treatise from persona responses | ABSORB | Treatise synthesis is core governance logic for Hermes |
| council-thread-reply.sh | Direct-post council reply to a thread | STRIP | Superseded by queue-based version; direct posting bypasses orchestrator |
| council-thread-reply-queue.sh | Queue-based council reply submission | ABSORB | Queue logic & council replies move to Hermes engagement engine |
| generate-council-iteration-article.sh | Posts council treatise updates to Moltstack | ABSORB | Article publishing orchestration moves to Hermes |
| generate-council-comparison-article.sh | Retroactive comparison article generator | ABSORB | Council content generation moves to Hermes |
| daily-polemic.sh | Direct daily philosophical post generator | STRIP | Deprecated Phase-1 direct poster; use queue version |
| daily-polemic-queue.sh | Queue-based daily polemic generator | ABSORB | Daily content scheduling & queueing move to Hermes |
| daily-polemic-heartbeat.sh | Orchestrates daily content pipeline with discovery | ABSORB | Heartbeat & proactive posting belong in Hermes scheduler |
| daily-polemic-personas.sh | Persona metadata library for polemics | KEEP | Persona definitions remain as a shared config resource |
| moltbook-heartbeat.sh | Basic Moltbook health & skill check | ABSORB | Heartbeat probes move to Hermes health module |
| moltbook-heartbeat-enhanced.sh | Comprehensive social engagement heartbeat | ABSORB | Enhanced heartbeat logic moves to Hermes |
| moltbook-heartbeat-minimal.sh | Minimal non-interactive heartbeat probe | ABSORB | Minimal heartbeat is redundant under Hermes |
| moltstack-post-article.sh | Long-form essay publisher to Moltstack | ABSORB | Publishing workflow moves to Hermes content pipeline |
| moltstack-generate-article.sh | AI essay generator with council rotation | ABSORB | Essay generation moves to Hermes content service |
| moltstack-generate-article-queue.sh | Queue-based essay generation | ABSORB | Generation queueing moves to Hermes |
| moltstack-heartbeat.sh | Weekly essay generation & cross-posting heartbeat | ABSORB | Weekly orchestration moves to Hermes scheduler |
| moltbook-api-wrapper.sh | Resilient API wrapper with proxy fallback | KEEP | Shared API utility still required by other components |
| moltbook-cli.sh | Command-line interface for Moltbook API | KEEP | Manual CLI tool remains useful for operators |
| moltbook-diagnose.sh | Agent status diagnostic (403 troubleshooting) | KEEP | Diagnostic utility still needed for debugging |
| thread-monitor.sh | Monitors threads & generates continuations | ABSORB | Thread monitoring & continuation logic moves to Hermes |
| monitor-submolt.sh | Ethics-convergence submolt monitor | ABSORB | Submolt monitoring moves to Hermes reactive engine |
| check-comments.sh | Check & reply to comments (direct) | STRIP | Deprecated direct version; replaced by v2/queue |
| check-comments-v2.sh | Check & reply to comments via CLI helpers | ABSORB | Comment handling moves to Hermes reactive handler |
| discover-relevant-threads.sh | Semantic discovery of philosophical threads | ABSORB | Discovery service integration moves to Hermes |
| archive-thread.sh | Archives completed/dead threads | KEEP | Simple maintenance utility still needed |
| archive-thread-to-noosphere.sh | Archives threads into Noosphere memory | ABSORB | Noosphere archival moves to Hermes memory manager |
| engagement-stats.sh | Displays Phase-2 engagement statistics | KEEP | Observability tool still required |
| check-engagement-health.sh | Health check for engagement services | KEEP | Health monitoring utility still required |
| trigger-engagement-cycle.sh | Manual trigger for engagement cycle | KEEP | Manual test/trigger tool still useful |
| comment-on-post.sh | Direct comment on a post | STRIP | Deprecated direct action; bypasses queue |
| comment-on-post-queue.sh | Queue-based comment submission | ABSORB | Comment queueing moves to Hermes engagement engine |
| comment-on-post-v2.sh | Comment via CLI helpers | ABSORB | Comment logic moves to Hermes |
| follow-molty.sh | Direct follow action | STRIP | Deprecated direct action; use queue version |
| follow-molty-queue.sh | Queue-based follow submission | ABSORB | Follow queueing moves to Hermes |
| follow-with-criteria.sh | Follow with criteria checking | ABSORB | Follow logic moves to Hermes |
| reply-to-mention.sh | Direct mention reply | STRIP | Deprecated direct action; use queue version |
| reply-to-mention-queue.sh | Queue-based mention reply | ABSORB | Mention reply queueing moves to Hermes |
| check-mentions.sh | Check mentions (direct) | STRIP | Deprecated direct version; replaced by v2 |
| check-mentions-v2.sh | Check mentions via CLI helpers | ABSORB | Mention monitoring moves to Hermes reactive handler |
| eastern-philosopher-router.sh | Routes questions to eastern philosopher persona | ABSORB | Persona routing moves to Hermes query router |
| generate-post-ai.sh | AI post generator (direct) | STRIP | Deprecated direct poster |
| generate-post.sh | Basic post generator (direct) | STRIP | Deprecated direct poster; replaced by v2 |
| generate-post-v2.sh | Post generator via CLI helpers | ABSORB | Post generation moves to Hermes content service |
| setup-cron-jobs.sh | Installs system cron jobs (backup, commits) | KEEP | System-level cron setup still needed |
| validate-cron-setup.sh | Validates cron job prerequisites | KEEP | Validation utility still needed |
| noosphere-scheduler.sh | Daily Noosphere memory consolidation | ABSORB | Noosphere scheduling moves to Hermes |
| dropbox-processor.sh | Secure council dropbox submission processor | ABSORB | Submission processing moves to Hermes |
| dm-monitor.sh | DM inbox monitor with human approval | KEEP | DM monitor remains as standalone operator tool |
| handle-home-activity.sh | Delegates home-activity replies to personas | ABSORB | Home-activity routing moves to Hermes |

## Summary

- **KEEP**: 11 scripts — low-level utilities, diagnostics, CLI tools, config libraries, and system cron setup that remain useful outside Hermes.
- **ABSORB**: 30 scripts — core business logic (council, polemics, engagement, thread monitoring, posting, Noosphere) that should be migrated into the Hermes orchestrator and its services.
- **STRIP**: 9 scripts — deprecated direct-action versions and manual wrappers superseded by queue-based or orchestrated equivalents.
