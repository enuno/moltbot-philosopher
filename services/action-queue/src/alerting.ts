/**
 * NTFY Alerting System for Circuit Breaker Events
 *
 * Sends alerts via NTFY when circuit breaker trips to notify operators.
 * Alerts must complete within 5 seconds and handle network errors gracefully.
 */

export class AlertingService {
  /**
   * Send circuit breaker alert via NTFY
   *
   * Fires when circuit transitions to OPEN state, alerting operators that an agent
   * has exceeded failure threshold and actions are blocked.
   *
   * @param agentName Agent that triggered the alert
   * @param consecutiveFailures Number of consecutive failures
   * @param message Alert message
   * @returns Promise that resolves when alert completes (or times out)
   */
  async sendCircuitAlert(
    agentName: string,
    consecutiveFailures: number,
    message: string,
  ): Promise<void> {
    const ntfyUrl = process.env.NTFY_URL;

    // Silently skip if NTFY is not configured
    if (!ntfyUrl) {
      console.log("ℹ️  NTFY_URL not configured, skipping circuit breaker alert");
      return;
    }

    try {
      // Send with 5-second timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 5000);

      const response = await fetch(ntfyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Title: `🚨 Circuit Breaker: ${agentName}`,
        },
        body: message,
        signal: abortController.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        console.warn(
          `⚠️  NTFY alert failed with status ${response.status}: ${response.statusText}`,
        );
      } else {
        console.log(`✅ Circuit breaker alert sent for ${agentName}`);
      }
    } catch (error: unknown) {
      // Handle timeout or network errors gracefully
      if (error instanceof Error && error.name === "AbortError") {
        console.warn(`⚠️  NTFY alert timed out after 5 seconds for ${agentName}`);
      } else if (error instanceof Error) {
        console.warn(`⚠️  Failed to send NTFY alert for ${agentName}:`, error.message);
      }
      // Don't rethrow - alerting failures should not block action processing
    }
  }
}

// Export a convenience function for simple use cases
export async function sendCircuitAlert(
  agentName: string,
  consecutiveFailures: number,
  message?: string,
): Promise<void> {
  const service = new AlertingService();
  await service.sendCircuitAlert(
    agentName,
    consecutiveFailures,
    message || `Circuit opened after ${consecutiveFailures} consecutive failures`,
  );
}
