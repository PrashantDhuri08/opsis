import { Elysia, t } from "elysia";
import { runAgent } from "../agent/executor";
import { getChatHistory, clearChatHistory, getSnapshots } from "../db/sqlite";
import { executeTool } from "../tools";

export const chatRoutes = new Elysia({ prefix: "/api" })
  // Send message to the agent
  .post(
    "/chat",
    async ({ body }) => {
      const sessionId = body.sessionId || "default";
      const message = body.message;
      const provider = (body.provider || "ollama") as "ollama" | "gemini" | "openrouter";
      const model = body.model || "";
      const apiKey = body.apiKey || "";

      try {
        const result = await runAgent(sessionId, message, provider, model, apiKey);
        return {
          success: true,
          response: result.response,
          steps: result.steps,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
        };
      }
    },
    {
      body: t.Object({
        message: t.String(),
        sessionId: t.Optional(t.String()),
        provider: t.Optional(t.String()),
        model: t.Optional(t.String()),
        apiKey: t.Optional(t.String()),
      }),
    }
  )

  // Retrieve chat history
  .get(
    "/history",
    async ({ query }) => {
      const sessionId = query.sessionId || "default";
      const history = getChatHistory(sessionId);
      return {
        success: true,
        history,
      };
    },
    {
      query: t.Object({
        sessionId: t.Optional(t.String()),
      }),
    }
  )

  // Clear chat history
  .delete(
    "/history",
    async ({ query }) => {
      const sessionId = query.sessionId || "default";
      clearChatHistory(sessionId);
      return {
        success: true,
        message: `Chat history cleared for session: ${sessionId}`,
      };
    },
    {
      query: t.Object({
        sessionId: t.Optional(t.String()),
      }),
    }
  )

  // Retrieve historical snapshots
  .get(
    "/snapshots",
    async ({ query }) => {
      const limit = query.limit ? parseInt(query.limit) : 10;
      const snapshots = getSnapshots(limit);
      
      const parsed = snapshots.map((s) => ({
        id: s.id,
        created_at: s.created_at,
        free_disk_bytes: s.free_disk_bytes,
        total_disk_bytes: s.total_disk_bytes,
        top_processes: JSON.parse(s.top_processes),
        largest_folders: JSON.parse(s.largest_folders),
      }));

      return {
        success: true,
        snapshots: parsed,
      };
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
    }
  )

  // Manually trigger a system snapshot
  .post("/snapshots", async () => {
    try {
      const snapshot = await executeTool("create_snapshot", {});
      return {
        success: true,
        snapshot,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  });
