import { CircuitBreaker } from "../src/circuit-breaker";

describe("CircuitBreaker (7.7)", () => {
  it("starts CLOSED", () => {
    const cb = new CircuitBreaker();
    expect(cb.isTripped).toBe(false);
    expect(cb.getState()).toEqual({ isOpen: false, consecutiveFailures: 0 });
  });

  it("recordSuccess resets consecutive failures", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.getState().consecutiveFailures).toBe(0);
    expect(cb.isTripped).toBe(false);
  });

  it("two failures do not trip the circuit (default threshold 3)", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isTripped).toBe(false);
  });

  it("three consecutive failures trip the circuit", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isTripped).toBe(true);
  });

  it("onTripped callback fires exactly once when threshold reached", () => {
    const onTripped = jest.fn();
    const cb = new CircuitBreaker({ maxConsecutiveFailures: 3, onTripped });
    cb.recordFailure();
    cb.recordFailure();
    expect(onTripped).not.toHaveBeenCalled();
    cb.recordFailure(); // trips
    expect(onTripped).toHaveBeenCalledTimes(1);
    expect(onTripped).toHaveBeenCalledWith(3);
    cb.recordFailure(); // already open - should NOT call again
    expect(onTripped).toHaveBeenCalledTimes(1);
  });

  it("additional failures after trip do not re-call onTripped", () => {
    const onTripped = jest.fn();
    const cb = new CircuitBreaker({ maxConsecutiveFailures: 2, onTripped });
    cb.recordFailure();
    cb.recordFailure(); // trips
    cb.recordFailure();
    cb.recordFailure();
    expect(onTripped).toHaveBeenCalledTimes(1);
  });

  it("reset closes the circuit and clears failures", () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isTripped).toBe(true);
    cb.reset();
    expect(cb.isTripped).toBe(false);
    expect(cb.getState()).toEqual({ isOpen: false, consecutiveFailures: 0 });
  });

  it("custom maxConsecutiveFailures is respected", () => {
    const cb = new CircuitBreaker({ maxConsecutiveFailures: 1 });
    cb.recordFailure();
    expect(cb.isTripped).toBe(true);
  });

  it("getState returns accurate state", () => {
    const cb = new CircuitBreaker({ maxConsecutiveFailures: 5 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toEqual({ isOpen: false, consecutiveFailures: 2 });
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure(); // trips at 5
    expect(cb.getState()).toEqual({ isOpen: true, consecutiveFailures: 5 });
  });
});
