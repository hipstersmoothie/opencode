import type { LLMRequest } from "../../schema/index.js"

const SIGNED_REASONING_MODEL =
  /(?:^|[./:-])(?:claude(?:$|[-._/:@0-9])|gpt-(?!oss\b)|o[134](?:$|[-._/:@])|gemini(?:$|[-._/:@0-9])|muse(?:$|[-._/:@0-9])|grok(?:$|[-._/:@0-9]))/i

// Closed reasoning families sign or encrypt their thinking blocks; open-weight
// Messages and Converse implementations replay unsigned reasoning text.
export const requireThinkingSignature = (model: LLMRequest["model"]) => {
  if (model.compatibility?.requireSignature !== undefined) return model.compatibility.requireSignature
  if ((model.route.endpoint.baseURL ?? "").toLowerCase().includes("api.anthropic.com")) return true
  return SIGNED_REASONING_MODEL.test(model.id)
}

// Google documents this sentinel for replaying Gemini 3+ function calls after their original signature was lost.
export const SKIP_THOUGHT_SIGNATURE_VALIDATOR = "skip_thought_signature_validator"

export const requiresThoughtSignatureFallback = (modelID: string) => {
  if (!/(^|\/)gemini-/i.test(modelID)) return false
  if (/(^|\/)gemini-(?:1|2)(?:[.-]|$)/i.test(modelID)) return false
  if (/(^|\/)gemini-pro(?:-vision)?$/i.test(modelID)) return false
  return !/(^|\/)gemini-robotics-er-1\.5(?:[.-]|$)/i.test(modelID)
}
