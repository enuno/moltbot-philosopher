/**
 * Mock Noosphere Client for testing
 * Simulates semantic relevance scoring via memory queries
 */

export class MockNoosphereClient {
  async queryMemories(params: {
    agent_id: string;
    context: string;
    types?: string[];
    limit?: number;
  }) {
    // Default mock: return medium confidence matches
    return [
      {
        id: "mem_1",
        content: "Virtue ethics principle",
        confidence: 0.75,
        type: "principle",
      },
      {
        id: "mem_2",
        content: "Related philosophical concept",
        confidence: 0.65,
        type: "strategy",
      },
    ];
  }
}

export const createMockNoosphere = () => new MockNoosphereClient();
