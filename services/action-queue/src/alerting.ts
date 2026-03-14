/**
 * NTFY Alerting System for Circuit Breaker Events
 *
 * Sends alerts via NTFY when circuit breaker trips to notify operators.
 * Alerts must complete within 5 seconds and handle network errors gracefully.
 */

/**
 * Send circuit breaker alert via NTFY
 *
 * Fires when circuit transitions to OPEN state, alerting operators that an agent
 * has exceeded failure threshold and actions are blocked.
 *
 * @param agentName Agent that triggered the alert
 * @param consecutiveFailures Number of consecutive failures
 * @param lastError Optional error message from last failure
 * @returns Promise that resolves when alert completes (or times out)
 */
export async function sendCircuitAlert(
  agentName: string,
  consecutiveFailures: number,
  lastError?: string,
): Promise<void> {
  const ntfyUrl = process.env.NTFY_URL;

  // Silently skip if NTFY is not configured
  if (!ntfyUrl) {
    console.log("ℹ️  NTFY_URL not configured, skipping circuit breaker alert");
    return;
  }

  const message = buildAlertMessage(agentName, consecutiveFailures, lastError);

  try {
    // Send with 5-second timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 5000);

    const response = await fetch(ntfyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Title: `🚨 Circuit Breaker Opened: ${agentName}`,
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
  } catch (error: any) {
    // Handle timeout or network errors gracefully
    if (error.name === "AbortError") {
      console.warn(`⚠️  NTFY alert timed out after 5 seconds for ${agentName}`);
    } else {
      console.warn(`⚠️  Failed to send NTFY alert for ${agentName}:`, error.message);
    }
    // Don't rethrow - alerting failures should not block action processing
  }
}

/**
 * Build NTFY alert message body
 *
 * Creates a human-readable message describing the circuit breaker trip,
 * including agent name, failure count, and last error if available.
 */
function buildAlertMessage(
  agentName: string,
  consecutiveFailures: number,
  lastError?: string,
): string {
  const lines = [
    `Agent: ${agentName}`,
    `Consecutive Failures: ${consecutiveFailures}`,
    `Status: Circuit OPEN - actions blocked`,
    `Time: ${new Date().toISOString()}`,
  ];

  if (lastError) {
    lines.push(`Last Error: ${lastError}`);
  }

  lines.push("");
  lines.push("Action Required:");
  lines.push("- Investigate root cause of failures");
  lines.push("- Monitor agent logs: docker compose logs -f [agent-name]-philosopher");
  lines.push("- Circuit will auto-transition to HALF_OPEN after 1 hour");
  lines.push("- Or manually reset: CLI command (P7.7.4)");

  return lines.join("\n");
}
