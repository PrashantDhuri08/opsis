import { scanDisk } from "./scanDisk";
import { scanProcesses } from "./scanProcesses";
import { scanApps } from "./scanApps";
import { scanStartup } from "./scanStartup";
import { scanDownloads } from "./scanDownloads";
import { saveSnapshot, getSnapshots } from "../db/sqlite";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "scan_disk",
    description: "Scan drive space, list largest folders and files in a path, and get total/free space of the drive.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute folder path to scan (e.g. 'C:\\\\', 'C:\\\\Users\\\\prash').",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "scan_processes",
    description: "Scan and list running processes, CPU usage, and Memory usage (returning top CPU and memory consumers).",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "scan_apps",
    description: "Scan and list all installed applications on the Windows system along with versions, publishers, install dates, and sizes.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "scan_startup",
    description: "Scan and list all applications configured to run automatically when the system boots up.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "scan_downloads",
    description: "Scan and analyze the user's Downloads folder, categorizing files (documents, images, videos, archives, executables) and identifying files older than 30 days or files over 100MB.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_snapshots",
    description: "Retrieve a list of historical system snapshots (disk space, top processes, largest folders) from SQLite database to compare system state changes over time.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of snapshots to retrieve (defaults to 10).",
        },
      },
    },
  },
  {
    name: "create_snapshot",
    description: "Capture the current system status (disk space, top processes, and largest folders) and store it as a historical snapshot in the SQLite database.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];

export async function executeTool(name: string, args: any): Promise<any> {
  console.log(`[Tool Execution] Executing tool: ${name} with args:`, args);
  switch (name) {
    case "scan_disk": {
      if (!args.path) {
        throw new Error("Missing required argument: path");
      }
      return await scanDisk(args.path);
    }
    case "scan_processes": {
      return await scanProcesses();
    }
    case "scan_apps": {
      return await scanApps();
    }
    case "scan_startup": {
      return await scanStartup();
    }
    case "scan_downloads": {
      return await scanDownloads();
    }
    case "get_snapshots": {
      const limit = args.limit ?? 10;
      const snapshots = getSnapshots(limit);
      return snapshots.map((s) => ({
        id: s.id,
        created_at: s.created_at,
        free_disk_bytes: s.free_disk_bytes,
        total_disk_bytes: s.total_disk_bytes,
        top_processes: JSON.parse(s.top_processes),
        largest_folders: JSON.parse(s.largest_folders),
      }));
    }
    case "create_snapshot": {
      // 1. Scan the C drive root for sizes
      const diskResult = await scanDisk("C:\\");
      // 2. Scan processes for memory usage
      const procResult = await scanProcesses();
      
      const freeDiskBytes = diskResult.freeSpaceBytes ?? 0;
      const totalDiskBytes = diskResult.totalSpaceBytes ?? 0;
      const topMemoryProcesses = procResult.topMemory || [];
      const largestFolders = diskResult.largestFolders || [];

      // Save to SQLite
      const snapshot = saveSnapshot(
        freeDiskBytes,
        totalDiskBytes,
        JSON.stringify(topMemoryProcesses),
        JSON.stringify(largestFolders)
      );

      return {
        id: snapshot.id,
        created_at: snapshot.created_at,
        free_disk_bytes: snapshot.free_disk_bytes,
        total_disk_bytes: snapshot.total_disk_bytes,
        top_processes: topMemoryProcesses,
        largest_folders: largestFolders,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
