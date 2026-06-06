import { Database } from "bun:sqlite";
import { join } from "node:path";

// Initialize SQLite database in the current workspace directory
const DB_PATH = join(process.cwd(), "opsis.db");
const db = new Database(DB_PATH);

export interface Snapshot {
  id: number;
  created_at: string;
  free_disk_bytes: number;
  total_disk_bytes: number;
  top_processes: string; // JSON string
  largest_folders: string; // JSON string
}

export interface ChatMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export function initDb() {
  // Create snapshots table
  db.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      free_disk_bytes INTEGER NOT NULL,
      total_disk_bytes INTEGER NOT NULL,
      top_processes TEXT NOT NULL,
      largest_folders TEXT NOT NULL
    )
  `);

  // Create chat_history table
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  console.log(`Database initialized at: ${DB_PATH}`);
}

export function saveSnapshot(
  freeDiskBytes: number,
  totalDiskBytes: number,
  topProcesses: string,
  largestFolders: string
): Snapshot {
  const query = db.prepare(`
    INSERT INTO snapshots (free_disk_bytes, total_disk_bytes, top_processes, largest_folders)
    VALUES (?, ?, ?, ?)
    RETURNING id, created_at, free_disk_bytes, total_disk_bytes, top_processes, largest_folders
  `);
  
  const result = query.get(freeDiskBytes, totalDiskBytes, topProcesses, largestFolders) as Snapshot;
  return result;
}

export function getSnapshots(limit = 10): Snapshot[] {
  const query = db.prepare(`
    SELECT id, created_at, free_disk_bytes, total_disk_bytes, top_processes, largest_folders
    FROM snapshots
    ORDER BY id DESC
    LIMIT ?
  `);
  return query.all(limit) as Snapshot[];
}

export function saveChatMessage(
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string
): ChatMessage {
  const query = db.prepare(`
    INSERT INTO chat_history (session_id, role, content)
    VALUES (?, ?, ?)
    RETURNING id, session_id, role, content, timestamp
  `);
  const result = query.get(sessionId, role, content) as ChatMessage;
  return result;
}

export function getChatHistory(sessionId: string): ChatMessage[] {
  const query = db.prepare(`
    SELECT id, session_id, role, content, timestamp
    FROM chat_history
    WHERE session_id = ?
    ORDER BY id ASC
  `);
  return query.all(sessionId) as ChatMessage[];
}

export function clearChatHistory(sessionId: string) {
  const query = db.prepare(`
    DELETE FROM chat_history
    WHERE session_id = ?
  `);
  query.run(sessionId);
}
