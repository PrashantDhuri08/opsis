import { Database } from "bun:sqlite";
import { join } from "node:path";

const DB_PATH = join(process.cwd(), "opsis.db");
const db = new Database(DB_PATH);

function seed() {
  console.log("🌱 Seeding database with historical snapshots...");

  // Ensure tables exist
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

  // Clear existing snapshots to avoid duplicate bloat
  db.run("DELETE FROM snapshots");

  const totalDisk = 256 * 1024 * 1024 * 1024; // 256 GB

  const mockProcesses = [
    { pid: 4512, name: "chrome", cpuPercent: 3.5, memoryMB: 1240 },
    { pid: 8120, name: "slack", cpuPercent: 0.8, memoryMB: 980 },
    { pid: 1044, name: "vscode", cpuPercent: 1.2, memoryMB: 650 },
    { pid: 2311, name: "docker", cpuPercent: 0.1, memoryMB: 480 },
  ];

  const mockFolders1 = [
    { name: "Users", path: "C:\\Users", size: 60 * 1024 * 1024 * 1024 },
    { name: "Program Files", path: "C:\\Program Files", size: 45 * 1024 * 1024 * 1024 },
    { name: "Windows", path: "C:\\Windows", size: 25 * 1024 * 1024 * 1024 },
  ];

  const mockFolders2 = [
    { name: "Users", path: "C:\\Users", size: 85 * 1024 * 1024 * 1024 }, // users folder grew
    { name: "Program Files", path: "C:\\Program Files", size: 48 * 1024 * 1024 * 1024 },
    { name: "Windows", path: "C:\\Windows", size: 26 * 1024 * 1024 * 1024 },
  ];

  const mockFolders3 = [
    { name: "Users", path: "C:\\Users", size: 110 * 1024 * 1024 * 1024 }, // users folder grew significantly (e.g. downloads)
    { name: "Program Files", path: "C:\\Program Files", size: 50 * 1024 * 1024 * 1024 },
    { name: "Windows", path: "C:\\Windows", size: 26 * 1024 * 1024 * 1024 },
  ];

  // Insert mock snapshots with custom dates (SQLite allows overriding created_at)
  const stmt = db.prepare(`
    INSERT INTO snapshots (created_at, free_disk_bytes, total_disk_bytes, top_processes, largest_folders)
    VALUES (?, ?, ?, ?, ?)
  `);

  // 1. Snapshot 7 days ago
  const date7DaysAgo = new Date();
  date7DaysAgo.setDate(date7DaysAgo.getDate() - 7);
  stmt.run(
    date7DaysAgo.toISOString().replace("T", " ").substring(0, 19),
    120 * 1024 * 1024 * 1024, // 120 GB free
    totalDisk,
    JSON.stringify(mockProcesses),
    JSON.stringify(mockFolders1)
  );

  // 2. Snapshot 3 days ago
  const date3DaysAgo = new Date();
  date3DaysAgo.setDate(date3DaysAgo.getDate() - 3);
  stmt.run(
    date3DaysAgo.toISOString().replace("T", " ").substring(0, 19),
    95 * 1024 * 1024 * 1024, // 95 GB free
    totalDisk,
    JSON.stringify(mockProcesses),
    JSON.stringify(mockFolders2)
  );

  // 3. Snapshot yesterday
  const dateYesterday = new Date();
  dateYesterday.setDate(dateYesterday.getDate() - 1);
  stmt.run(
    dateYesterday.toISOString().replace("T", " ").substring(0, 19),
    70 * 1024 * 1024 * 1024, // 70 GB free
    totalDisk,
    JSON.stringify(mockProcesses),
    JSON.stringify(mockFolders3)
  );

  console.log("✨ Seeding completed. 3 snapshots created successfully.");
}

seed();
