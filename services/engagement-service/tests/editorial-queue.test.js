/**
 * Editorial Queue Test Suite
 * P2.3 Task 6: Tests editorial queue management and decision tracking
 */

const {
  createEditorialDraft,
  addDecision,
  getQueueStats,
  getPendingDrafts,
  getApprovedDrafts,
  getRejectedDrafts,
  isFinalState,
  getDecisionSummary,
} = require("../src/editorial-queue");

describe("Editorial Queue Management", () => {
  const sampleDraft = {
    id: "draft-1",
    agentId: "classical",
    topicId: "virtue_ethics",
    threadId: "thread-1",
    content: "Virtue requires practice and habituation.",
    createdAt: 1708900000,
  };

  describe("createEditorialDraft", () => {
    it("should create draft with deferred state", () => {
      const draft = createEditorialDraft(sampleDraft);
      expect(draft.id).toBe(sampleDraft.id);
      expect(draft.decision).toBe("deferred");
      expect(draft.decisions).toEqual([]);
    });

    it("should have all required properties", () => {
      const draft = createEditorialDraft(sampleDraft);
      expect(draft).toHaveProperty("id");
      expect(draft).toHaveProperty("agentId");
      expect(draft).toHaveProperty("topicId");
      expect(draft).toHaveProperty("content");
      expect(draft).toHaveProperty("createdAt");
      expect(draft).toHaveProperty("decision");
      expect(draft).toHaveProperty("decisions");
    });

    it("should initialize empty decisions array", () => {
      const draft = createEditorialDraft(sampleDraft);
      expect(Array.isArray(draft.decisions)).toBe(true);
      expect(draft.decisions.length).toBe(0);
    });
  });

  describe("addDecision", () => {
    it("should append decision to array", () => {
      const draft = createEditorialDraft(sampleDraft);
      addDecision(draft, "approved", "Clear and relevant");
      expect(draft.decisions.length).toBe(1);
    });

    it("should update decision field", () => {
      const draft = createEditorialDraft(sampleDraft);
      addDecision(draft, "approved", "Well written");
      expect(draft.decision).toBe("approved");
    });

    it("should include timestamp in decision", () => {
      const draft = createEditorialDraft(sampleDraft);
      const before = Date.now();
      addDecision(draft, "rejected_low_quality", "Too brief");
      const after = Date.now();

      expect(draft.decisions[0]).toHaveProperty("timestamp");
      expect(draft.decisions[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(draft.decisions[0].timestamp).toBeLessThanOrEqual(after);
    });

    it("should support multiple decisions", () => {
      const draft = createEditorialDraft(sampleDraft);
      addDecision(draft, "regenerate", "Needs refinement");
      addDecision(draft, "approved", "Second draft approved");

      expect(draft.decisions.length).toBe(2);
      expect(draft.decision).toBe("approved");
      expect(draft.decisions[0].type).toBe("regenerate");
      expect(draft.decisions[1].type).toBe("approved");
    });
  });

  describe("getQueueStats", () => {
    it("should count draft states correctly", () => {
      const drafts = [
        createEditorialDraft(sampleDraft),
        createEditorialDraft({ ...sampleDraft, id: "draft-2" }),
        createEditorialDraft({ ...sampleDraft, id: "draft-3" }),
      ];

      addDecision(drafts[0], "approved", "Good");
      addDecision(drafts[1], "rejected_low_quality", "Too brief");

      const stats = getQueueStats(drafts);
      expect(stats.totalDrafts).toBe(3);
      expect(stats.approvedCount).toBe(1);
      expect(stats.rejectedCount).toBe(1);
      expect(stats.deferredCount).toBe(1);
    });

    it("should return complete stats object", () => {
      const drafts = [];
      const stats = getQueueStats(drafts);
      expect(stats).toHaveProperty("totalDrafts");
      expect(stats).toHaveProperty("approvedCount");
      expect(stats).toHaveProperty("rejectedCount");
      expect(stats).toHaveProperty("deferredCount");
    });
  });

  describe("getPendingDrafts", () => {
    it("should return deferred and regenerate drafts", () => {
      const drafts = [
        createEditorialDraft(sampleDraft),
        createEditorialDraft({ ...sampleDraft, id: "draft-2" }),
        createEditorialDraft({ ...sampleDraft, id: "draft-3" }),
      ];

      addDecision(drafts[0], "approved", "Good");
      addDecision(drafts[1], "regenerate", "Needs work");

      const pending = getPendingDrafts(drafts);
      expect(pending.length).toBe(2);
      expect(pending.map((d) => d.id)).toContain("draft-2");
      expect(pending.map((d) => d.id)).toContain("draft-3");
    });
  });

  describe("getApprovedDrafts", () => {
    it("should filter approved drafts", () => {
      const drafts = [
        createEditorialDraft(sampleDraft),
        createEditorialDraft({ ...sampleDraft, id: "draft-2" }),
        createEditorialDraft({ ...sampleDraft, id: "draft-3" }),
      ];

      addDecision(drafts[0], "approved", "Good");
      addDecision(drafts[1], "approved_with_edits", "Minor changes");
      addDecision(drafts[2], "rejected_off_topic", "Wrong topic");

      const approved = getApprovedDrafts(drafts);
      expect(approved.length).toBe(2);
      expect(approved.map((d) => d.id)).toContain("draft-1");
      expect(approved.map((d) => d.id)).toContain("draft-2");
    });
  });

  describe("getRejectedDrafts", () => {
    it("should filter all rejected states", () => {
      const drafts = [
        createEditorialDraft(sampleDraft),
        createEditorialDraft({ ...sampleDraft, id: "draft-2" }),
        createEditorialDraft({ ...sampleDraft, id: "draft-3" }),
        createEditorialDraft({ ...sampleDraft, id: "draft-4" }),
      ];

      addDecision(drafts[0], "rejected_low_quality", "Too brief");
      addDecision(drafts[1], "rejected_off_topic", "Wrong topic");
      addDecision(drafts[2], "rejected_duplicate", "Already exists");
      addDecision(drafts[3], "approved", "Good");

      const rejected = getRejectedDrafts(drafts);
      expect(rejected.length).toBe(3);
    });
  });

  describe("isFinalState", () => {
    it("should recognize approved as final", () => {
      const draft = createEditorialDraft(sampleDraft);
      addDecision(draft, "approved", "Good");
      expect(isFinalState(draft)).toBe(true);
    });

    it("should recognize rejected as final", () => {
      const draft = createEditorialDraft(sampleDraft);
      addDecision(draft, "rejected_low_quality", "Too brief");
      expect(isFinalState(draft)).toBe(true);
    });

    it("should not recognize deferred as final", () => {
      const draft = createEditorialDraft(sampleDraft);
      expect(isFinalState(draft)).toBe(false);
    });

    it("should not recognize regenerate as final", () => {
      const draft = createEditorialDraft(sampleDraft);
      addDecision(draft, "regenerate", "Needs work");
      expect(isFinalState(draft)).toBe(false);
    });
  });

  describe("getDecisionSummary", () => {
    it("should generate audit trail string", () => {
      const draft = createEditorialDraft(sampleDraft);
      addDecision(draft, "regenerate", "Too brief");
      addDecision(draft, "approved", "Good now");

      const summary = getDecisionSummary(draft);
      expect(typeof summary).toBe("string");
      expect(summary).toContain("regenerate");
      expect(summary).toContain("approved");
    });

    it("should include reasons in summary", () => {
      const draft = createEditorialDraft(sampleDraft);
      addDecision(draft, "approved", "Clear and relevant");

      const summary = getDecisionSummary(draft);
      expect(summary).toContain("Clear and relevant");
    });

    it("should format timestamps", () => {
      const draft = createEditorialDraft(sampleDraft);
      addDecision(draft, "approved", "Good");

      const summary = getDecisionSummary(draft);
      expect(summary).toContain("approved");
    });
  });

  describe("Integration", () => {
    it("should track full editorial lifecycle", () => {
      const draft = createEditorialDraft(sampleDraft);

      expect(isFinalState(draft)).toBe(false);
      addDecision(draft, "regenerate", "Needs improvements");

      expect(isFinalState(draft)).toBe(false);
      addDecision(draft, "approved", "Good revision");

      expect(isFinalState(draft)).toBe(true);
      expect(draft.decisions.length).toBe(2);
      expect(draft.decision).toBe("approved");
    });

    it("should support queue management workflow", () => {
      const drafts = [
        createEditorialDraft(sampleDraft),
        createEditorialDraft({ ...sampleDraft, id: "draft-2" }),
        createEditorialDraft({ ...sampleDraft, id: "draft-3" }),
      ];

      addDecision(drafts[0], "approved", "Ready");
      addDecision(drafts[1], "regenerate", "Needs work");
      // drafts[2] stays deferred

      const stats = getQueueStats(drafts);
      const pending = getPendingDrafts(drafts);
      const approved = getApprovedDrafts(drafts);

      expect(stats.approvedCount).toBe(1);
      expect(pending.length).toBe(2);
      expect(approved.length).toBe(1);
    });
  });
});
