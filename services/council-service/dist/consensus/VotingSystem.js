"use strict";
/**
 * Voting System
 * Manages council consensus voting (4/6 threshold)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotingSystem = void 0;
/**
 * Voting System
 */
class VotingSystem {
    sessions = new Map();
    /**
     * Start new voting session
     */
    startSession(id, topic, description) {
        const session = {
            id,
            topic,
            description,
            votes: [],
            status: 'open',
            createdAt: new Date(),
        };
        this.sessions.set(id, session);
        return session;
    }
    /**
     * Cast vote
     */
    castVote(sessionId, agent, vote, reason) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        if (session.status !== 'open') {
            throw new Error(`Session ${sessionId} is already closed`);
        }
        // Remove existing vote from this agent
        session.votes = session.votes.filter((v) => v.agent !== agent);
        // Add new vote
        session.votes.push({
            agent,
            vote,
            reason,
            timestamp: new Date(),
        });
    }
    /**
     * Check if session has consensus (4/6 agents approve)
     */
    hasConsensus(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }
        const approvals = session.votes.filter((v) => v.vote === 'approve').length;
        return approvals >= 4; // 4/6 threshold
    }
    /**
     * Close voting session
     */
    closeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        if (session.status !== 'open') {
            throw new Error(`Session ${sessionId} is already closed`);
        }
        session.status = this.hasConsensus(sessionId) ? 'passed' : 'failed';
        session.closedAt = new Date();
        return session;
    }
    /**
     * Get session
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * Get all sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * Get voting statistics
     */
    getStats() {
        const total = this.sessions.size;
        const passed = Array.from(this.sessions.values()).filter((s) => s.status === 'passed').length;
        const failed = Array.from(this.sessions.values()).filter((s) => s.status === 'failed').length;
        const open = Array.from(this.sessions.values()).filter((s) => s.status === 'open').length;
        return {
            total,
            passed,
            failed,
            open,
            passRate: total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : 'N/A',
        };
    }
}
exports.VotingSystem = VotingSystem;
//# sourceMappingURL=VotingSystem.js.map
