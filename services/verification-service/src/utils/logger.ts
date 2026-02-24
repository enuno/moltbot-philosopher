import type { LogContext } from "../types";

export function logInfo(message: string, ctx: LogContext) {
  console.log(
    JSON.stringify({
      level: "info",
      message,
      ...ctx,
      ts: new Date().toISOString(),
    }),
  );
}

export function logWarn(message: string, ctx: LogContext) {
  console.log(
    JSON.stringify({
      level: "warn",
      message,
      ...ctx,
      ts: new Date().toISOString(),
    }),
  );
}

export function logError(message: string, ctx: LogContext) {
  console.log(
    JSON.stringify({
      level: "error",
      message,
      ...ctx,
      ts: new Date().toISOString(),
    }),
  );
}
