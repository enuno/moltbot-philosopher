"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
function logInfo(message, ctx) {
  console.log(
    JSON.stringify({
      level: "info",
      message,
      ...ctx,
      ts: new Date().toISOString(),
    }),
  );
}
function logWarn(message, ctx) {
  console.log(
    JSON.stringify({
      level: "warn",
      message,
      ...ctx,
      ts: new Date().toISOString(),
    }),
  );
}
function logError(message, ctx) {
  console.log(
    JSON.stringify({
      level: "error",
      message,
      ...ctx,
      ts: new Date().toISOString(),
    }),
  );
}
//# sourceMappingURL=logger.js.map
