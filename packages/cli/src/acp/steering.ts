import { RequestError, type ContentBlock } from "@agentclientprotocol/sdk"
import { Schema } from "effect"

/** Adds a message to the running turn without cancelling it (agentclientprotocol/agent-client-protocol#1261). */
export const Method = "_session/steering"

/** Advertised in the top-level `InitializeResponse._meta`. */
export const Advertised = { steering: { supported: true } }

export type Request = {
  readonly sessionId: string
  readonly prompt: ReadonlyArray<ContentBlock>
  readonly _meta?: { readonly steering?: { readonly idleBehavior?: "promptRequired" } }
}

export type Outcome = "injected" | "promptRequired" | "startedNewTurn" | "failed"

const Params = Schema.Struct({
  sessionId: Schema.NonEmptyString,
  prompt: Schema.NonEmptyArray(
    Schema.declare(
      (block): block is ContentBlock =>
        typeof block === "object" && block !== null && "type" in block && typeof block.type === "string",
    ),
  ),
  _meta: Schema.optional(
    Schema.Struct({
      steering: Schema.optional(Schema.Struct({ idleBehavior: Schema.optional(Schema.Literal("promptRequired")) })),
    }),
  ),
})

export function parse(params: unknown): Request {
  if (!Schema.is(Params)(params))
    throw RequestError.invalidParams(undefined, "steering requires a sessionId and a non-empty prompt")
  return params
}

export * as ACPSteering from "./steering"
