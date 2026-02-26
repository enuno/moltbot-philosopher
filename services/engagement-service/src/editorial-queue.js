/**
 * Editorial Queue Management
 * P2.3 Task 6: Manages editorial drafts and decision tracking
 */

/**
 * Create new editorial draft with deferred initial state
 *
 * @param {object} draftData - Draft data
 * @returns {object} Draft with id, agentId, topicId, content, createdAt, decision, decisions
 */
function createEditorialDraft(draftData) {
  return {
    id: draftData.id,
    agentId: draftData.agentId,
    topicId: draftData.topicId,
    threadId: draftData.threadId,
    content: draftData.content,
    createdAt: draftData.createdAt,
    decision: "deferred",
    decisions: [],
  };
}

/**
 * Add decision to draft's audit trail
 *
 * @param {object} draft - Editorial draft
 * @param {string} decisionType - Decision type (approved, rejected_*, regenerate, deferred)
 * @param {string} reason - Decision reason
 */
function addDecision(draft, decisionType, reason) {
  if (!draft || !draft.decisions) {
    return;
  }

  draft.decisions.push({
    type: decisionType,
    reason,
    timestamp: Date.now(),
  });

  draft.decision = decisionType;
}

/**
 * Get queue statistics
 *
 * @param {array} drafts - All drafts
 * @returns {object} Stats with totalDrafts, approvedCount, rejectedCount, deferredCount
 */
function getQueueStats(drafts) {
  const stats = {
    totalDrafts: (drafts || []).length,
    approvedCount: 0,
    rejectedCount: 0,
    deferredCount: 0,
  };

  (drafts || []).forEach((draft) => {
    if (!draft) return;

    if (draft.decision === "approved" || draft.decision === "approved_with_edits") {
      stats.approvedCount++;
    } else if (draft.decision.startsWith("rejected_")) {
      stats.rejectedCount++;
    } else if (draft.decision === "deferred") {
      stats.deferredCount++;
    }
  });

  return stats;
}

/**
 * Get pending drafts (deferred or regenerate)
 *
 * @param {array} drafts - All drafts
 * @returns {array} Pending drafts
 */
function getPendingDrafts(drafts) {
  if (!drafts) {
    return [];
  }

  return drafts.filter(
    (d) => d && (d.decision === "deferred" || d.decision === "regenerate")
  );
}

/**
 * Get approved drafts
 *
 * @param {array} drafts - All drafts
 * @returns {array} Approved drafts
 */
function getApprovedDrafts(drafts) {
  if (!drafts) {
    return [];
  }

  return drafts.filter(
    (d) => d && (d.decision === "approved" || d.decision === "approved_with_edits")
  );
}

/**
 * Get rejected drafts
 *
 * @param {array} drafts - All drafts
 * @returns {array} Rejected drafts
 */
function getRejectedDrafts(drafts) {
  if (!drafts) {
    return [];
  }

  return drafts.filter(
    (d) => d && d.decision && d.decision.startsWith("rejected_")
  );
}

/**
 * Check if draft is in a final state
 *
 * @param {object} draft - Editorial draft
 * @returns {boolean} True if draft is approved or rejected
 */
function isFinalState(draft) {
  if (!draft) {
    return false;
  }

  const finalStates = [
    "approved",
    "approved_with_edits",
    "rejected_low_quality",
    "rejected_off_topic",
    "rejected_duplicate",
  ];

  return finalStates.includes(draft.decision);
}

/**
 * Get decision summary audit trail
 *
 * @param {object} draft - Editorial draft
 * @returns {string} Audit trail string
 */
function getDecisionSummary(draft) {
  if (!draft || !draft.decisions) {
    return "No decisions recorded";
  }

  const parts = [];

  draft.decisions.forEach((decision) => {
    const date = new Date(decision.timestamp).toISOString();
    parts.push(`${date}: ${decision.type} - ${decision.reason}`);
  });

  return parts.join("\n");
}

module.exports = {
  createEditorialDraft,
  addDecision,
  getQueueStats,
  getPendingDrafts,
  getApprovedDrafts,
  getRejectedDrafts,
  isFinalState,
  getDecisionSummary,
};
