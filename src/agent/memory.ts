import { getChatHistory, saveChatMessage, getSnapshots } from "../db/sqlite";
import type { LLMMessage } from "../llm/ollama";

export async function loadHistory(sessionId: string): Promise<LLMMessage[]> {
  const history = getChatHistory(sessionId);
  return history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string
): Promise<void> {
  saveChatMessage(sessionId, role, content);
}

export async function getFormattedSnapshots(limit = 5): Promise<string> {
  const snapshots = getSnapshots(limit);
  if (snapshots.length === 0) {
    return "No historical snapshots available.";
  }

  return snapshots
    .map((s, index) => {
      const date = s.created_at;
      const freeGB = (s.free_disk_bytes / (1024 * 1024 * 1024)).toFixed(2);
      const totalGB = (s.total_disk_bytes / (1024 * 1024 * 1024)).toFixed(2);
      const usedGB = ((s.total_disk_bytes - s.free_disk_bytes) / (1024 * 1024 * 1024)).toFixed(2);

      let topProcStr = "";
      try {
        const procs = JSON.parse(s.top_processes);
        topProcStr = procs.slice(0, 3).map((p: any) => `${p.name} (${p.memoryMB}MB)`).join(", ");
      } catch {
        topProcStr = "Unknown";
      }

      let largeFoldStr = "";
      try {
        const folders = JSON.parse(s.largest_folders);
        largeFoldStr = folders.slice(0, 3).map((f: any) => {
          const sizeGB = (f.size / (1024 * 1024 * 1024)).toFixed(2);
          return `${f.name} (${sizeGB}GB)`;
        }).join(", ");
      } catch {
        largeFoldStr = "Unknown";
      }

      return `Snapshot #${index + 1} (${date}):
- Free space: ${freeGB} GB / Total: ${totalGB} GB (Used: ${usedGB} GB)
- Top Memory Processes: ${topProcStr}
- Largest Folders: ${largeFoldStr}`;
    })
    .join("\n\n");
}
