"use strict";
/**
 * Codex Manager
 * Manages ethics-convergence governance guardrails
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Codex = void 0;
const fs = __importStar(require("fs/promises"));
/**
 * Codex Manager
 */
class Codex {
    codexPath;
    state = null;
    constructor(codexPath) {
        this.codexPath = codexPath;
    }
    /**
     * Load codex from file
     */
    async load() {
        try {
            const data = await fs.readFile(this.codexPath, 'utf-8');
            this.state = JSON.parse(data);
            // Parse dates
            this.state.lastIterationDate = new Date(this.state.lastIterationDate);
            this.state.guardrails.forEach((g) => {
                g.createdAt = new Date(g.createdAt);
                g.updatedAt = new Date(g.updatedAt);
            });
            return this.state;
        }
        catch (error) {
            // Initialize new codex if doesn't exist
            this.state = {
                version: '1.0.0',
                guardrails: [],
                lastIterationDate: new Date(),
                iterationCount: 0,
            };
            await this.save();
            return this.state;
        }
    }
    /**
     * Save codex to file
     */
    async save() {
        if (!this.state) {
            throw new Error('Codex not loaded');
        }
        await fs.writeFile(this.codexPath, JSON.stringify(this.state, null, 2), 'utf-8');
    }
    /**
     * Add proposed guardrail
     */
    async proposeGuardrail(id, title, description, rationale) {
        if (!this.state) {
            await this.load();
        }
        const guardrail = {
            id,
            title,
            description,
            rationale,
            votes: [],
            status: 'proposed',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.state.guardrails.push(guardrail);
        await this.save();
        return guardrail;
    }
    /**
     * Record vote on guardrail
     */
    async vote(guardrailId, agent, vote, reason) {
        if (!this.state) {
            await this.load();
        }
        const guardrail = this.state.guardrails.find((g) => g.id === guardrailId);
        if (!guardrail) {
            throw new Error(`Guardrail ${guardrailId} not found`);
        }
        // Remove existing vote from this agent
        guardrail.votes = guardrail.votes.filter((v) => v.agent !== agent);
        // Add new vote
        guardrail.votes.push({ agent, vote, reason });
        guardrail.updatedAt = new Date();
        await this.save();
    }
    /**
     * Check if guardrail has consensus (4/6 agents)
     */
    hasConsensus(guardrailId) {
        if (!this.state) {
            throw new Error('Codex not loaded');
        }
        const guardrail = this.state.guardrails.find((g) => g.id === guardrailId);
        if (!guardrail) {
            return false;
        }
        const approvals = guardrail.votes.filter((v) => v.vote === 'approve').length;
        return approvals >= 4; // 4/6 threshold
    }
    /**
     * Activate guardrail (after consensus)
     */
    async activateGuardrail(guardrailId) {
        if (!this.state) {
            await this.load();
        }
        const guardrail = this.state.guardrails.find((g) => g.id === guardrailId);
        if (!guardrail) {
            throw new Error(`Guardrail ${guardrailId} not found`);
        }
        if (!this.hasConsensus(guardrailId)) {
            throw new Error('Cannot activate guardrail without consensus');
        }
        guardrail.status = 'active';
        guardrail.updatedAt = new Date();
        await this.save();
    }
    /**
     * Get all active guardrails
     */
    getActiveGuardrails() {
        if (!this.state) {
            throw new Error('Codex not loaded');
        }
        return this.state.guardrails.filter((g) => g.status === 'active');
    }
    /**
     * Get codex state
     */
    getState() {
        if (!this.state) {
            throw new Error('Codex not loaded');
        }
        return this.state;
    }
    /**
     * Increment iteration counter
     */
    async recordIteration() {
        if (!this.state) {
            await this.load();
        }
        this.state.iterationCount++;
        this.state.lastIterationDate = new Date();
        await this.save();
    }
}
exports.Codex = Codex;
//# sourceMappingURL=Codex.js.map
