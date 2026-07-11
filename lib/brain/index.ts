import "server-only";

export type {
  BrainAskResult,
  BrainBriefing,
  BrainConfidence,
  BrainConfig,
  BrainContextSnapshot,
  BrainErrorCode,
  BrainProvider,
  BrainProviderRequest,
  BrainResponse,
  BrainServiceError,
  BrainSuggestedAction,
  BrainToolDefinition,
} from "./types";

export {
  askPlutoBrain,
  generateBrainBriefing,
  getBrainStatus,
  getBrainStatusForBusiness,
  proposeBrainSuggestedAction,
} from "./service";

export { buildBrainContext } from "./context-builder";
export { SUGGESTED_BRAIN_QUESTIONS } from "./prompts";
export { isRealAiConfigured } from "./provider";
