import fetch from 'node-fetch';
import { ResponseDto, PhilosopherSelection } from './types';

// Circuit breaker state
let consecutiveTimeouts = 0;
let circuitBreakerOpen = false;
let circuitBreakerResetTime = 0;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 60 seconds
const TIMEOUT_THRESHOLD = 3;

/**
 * Generate response from Moltbook API for a given question and philosopher.
 * Implements 5s timeout and circuit breaker (3 consecutive timeouts).
 */
export async function generateResponse(
  question: string,
  philosophers: PhilosopherSelection[],
  moltbookUrl: string
): Promise<ResponseDto> {
  // Check circuit breaker
  if (circuitBreakerOpen) {
    if (Date.now() < circuitBreakerResetTime) {
      throw new Error('Circuit breaker open - API temporarily unavailable');
    }
    circuitBreakerOpen = false;
    consecutiveTimeouts = 0;
  }

  const primaryPhilosopher = philosophers[0].primary;
  const truncatedQuestion = question.length > 2000
    ? question.substring(0, 1000)
    : question;

  const customPrompt = `You are ${primaryPhilosopher.name}, the ${primaryPhilosopher.tradition} philosopher. Respond to this question in your voice: "${truncatedQuestion}"`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${moltbookUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customPrompt,
        contentType: 'comment',
      }),
      signal: controller.signal as any,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      consecutiveTimeouts++;
      if (consecutiveTimeouts >= TIMEOUT_THRESHOLD) {
        circuitBreakerOpen = true;
        circuitBreakerResetTime = Date.now() + CIRCUIT_BREAKER_TIMEOUT;
      }
      throw new Error(`API error: ${response.status}`);
    }

    // Reset timeout counter on success
    consecutiveTimeouts = 0;

    const data = await response.json() as { content?: string };
    const responseText = data.content || 'No response generated';

    return {
      philosopher: primaryPhilosopher.name,
      citation: `${primaryPhilosopher.tradition}`,
      response: responseText,
      topic: 'philosophy',
    };
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      consecutiveTimeouts++;
      if (consecutiveTimeouts >= TIMEOUT_THRESHOLD) {
        circuitBreakerOpen = true;
        circuitBreakerResetTime = Date.now() + CIRCUIT_BREAKER_TIMEOUT;
      }
      throw new Error('Moltbook API timeout');
    }
    throw error;
  }
}
