import { describe, expect, test } from "bun:test"
import type { SessionNotification } from "@agentclientprotocol/sdk"
import { delivered, rpcError, startSession, succeeded, textDelta, turn } from "./wire-fixture"

const text = (value: string) => [{ type: "text", text: value }]

describe("acp steering over the wire", () => {
  test("injects into the running turn, which streams the steer and resolves once it is answered", async () => {
    await using acp = await startSession({
      onPrompt: ({ sessionID, id, text }) =>
        text === "start" ? [delivered(sessionID, id), textDelta(sessionID, "msg_first", "working")] : [],
    })
    const sessionID = acp.sessionId

    const prompt = acp.prompt(sessionID, "start")
    await acp.waitForUpdate((item) => item.update.sessionUpdate === "agent_message_chunk", "first answer")
    expect(await acp.steer({ sessionId: sessionID, prompt: text("also this") })).toEqual({ outcome: "injected" })
    const steer = acp.server.prompts[1]!
    // The steer missed the idle check, so the session goes idle once and runs it in a successor execution.
    acp.server.send(succeeded(sessionID), ...turn(sessionID, steer.id, textDelta(sessionID, "msg_steered", "steered")))

    expect((await prompt).stopReason).toBe("end_turn")
    expect(acp.server.submissions).toEqual([
      { kind: "prompt", sessionID, id: expect.stringMatching(/^msg_/), text: "start", files: [], delivery: "steer" },
      { kind: "prompt", sessionID, id: steer.id, text: "also this", files: [], delivery: "steer" },
    ])
    expect(chunks(acp.updates)).toEqual([
      ["agent_message_chunk", "working"],
      ["agent_message_chunk", "steered"],
    ])
  })

  test("leaves an idle session to the client when asked, and otherwise starts a turn", async () => {
    await using acp = await startSession({
      onPrompt: ({ sessionID, id }) => turn(sessionID, id, textDelta(sessionID, "msg_answer", "answer")),
    })
    const sessionID = acp.sessionId

    expect(
      await acp.steer({
        sessionId: sessionID,
        prompt: text("later"),
        _meta: { steering: { idleBehavior: "promptRequired" } },
      }),
    ).toEqual({ outcome: "promptRequired" })
    expect(acp.server.submissions).toEqual([])

    expect(await acp.steer({ sessionId: sessionID, prompt: text("now") })).toEqual({ outcome: "startedNewTurn" })
    await acp.waitForUpdate((item) => item.update.sessionUpdate === "agent_message_chunk", "steered turn answer")
    expect(acp.server.prompts.map((item) => item.text)).toEqual(["now"])
  })

  test("rejects a steer without a session, a prompt, or a known idle behavior", async () => {
    await using acp = await startSession()

    for (const params of [
      { prompt: text("hi") },
      { sessionId: acp.sessionId, prompt: [] },
      { sessionId: acp.sessionId, prompt: text("hi"), _meta: { steering: { idleBehavior: "queue" } } },
      { sessionId: "ses_missing", prompt: text("hi") },
    ]) {
      expect(await rpcError(acp.steer(params))).toMatchObject({ code: -32602 })
    }
    expect(acp.server.submissions).toEqual([])
  })
})

function chunks(updates: readonly SessionNotification[]) {
  return updates.flatMap((item) =>
    item.update.sessionUpdate === "agent_message_chunk" || item.update.sessionUpdate === "user_message_chunk"
      ? [[item.update.sessionUpdate, item.update.content.type === "text" ? item.update.content.text : ""]]
      : [],
  )
}
