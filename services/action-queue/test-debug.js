const { CircuitBreaker } = require('./src/circuit-breaker');
const { WorkerStateEnum } = require('./src/types');

class MockDB {
  constructor() {
    this.failures = new Map();
  }
  
  async recordWorkerFailure(agentName) {
    const current = this.failures.get(agentName) || 0;
    const newCount = current + 1;
    this.failures.set(agentName, newCount);
    console.log(`recordWorkerFailure: ${agentName}, count now: ${newCount}`);
    return {
      agent_name: agentName,
      state: WorkerStateEnum.CLOSED,
      consecutive_failures: newCount,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }
  
  async recordWorkerSuccess(agentName) {
    this.failures.set(agentName, 0);
    return {
      agent_name: agentName,
      state: WorkerStateEnum.CLOSED,
      consecutive_failures: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }
  
  async openCircuit(agentName) {
    console.log(`openCircuit called for ${agentName}`);
  }
}

async function test() {
  const db = new MockDB();
  const cb = new CircuitBreaker({ maxConsecutiveFailures: 1 });
  
  console.log('Initial state:', cb.getState());
  
  await cb.recordFailure(db, 'test-agent');
  console.log('After 1 failure, state:', cb.getState());
  console.log('canProcess:', cb.canProcess());
  console.log('isTripped:', cb.isTripped());
}

test();
