import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { runPowerShell, runWithConcurrencyLimit } from "./utils";

interface FileEntry {
  name: string;
  path: string;
  size: number;
}

interface FolderEntry {
  name: string;
  path: string;
  size: number;
}

export async function scanDisk(targetPath: string) {
  // Normalize path format
  let cleanPath = targetPath.trim();
  if (!cleanPath.endsWith("\\") && !cleanPath.endsWith("/")) {
    cleanPath += "\\";
  }

  // 1. Get drive space info using PowerShell
  let totalSpace: number | undefined;
  let freeSpace: number | undefined;
  try {
    const driveMatch = cleanPath.match(/^([a-zA-Z]):/);
    const driveLetter = driveMatch ? driveMatch[1] : "C";
    const psCmd = `Get-Volume -DriveLetter ${driveLetter} | Select-Object Size, SizeRemaining | ConvertTo-Json`;
    const psOutput = await runPowerShell(psCmd);
    const parsed = JSON.parse(psOutput.trim());
    if (parsed) {
      const vol = Array.isArray(parsed) ? parsed[0] : parsed;
      totalSpace = vol.Size;
      freeSpace = vol.SizeRemaining;
    }
  } catch (err) {
    console.error("Failed to get drive space info via PowerShell:", err);
  }

  // 2. Traversal settings
  const largestFiles: FileEntry[] = [];
  const largestFolders: FolderEntry[] = [];

  const addLargestFile = (item: FileEntry) => {
    if (largestFiles.length < 20) {
      largestFiles.push(item);
      largestFiles.sort((a, b) => b.size - a.size);
    } else if (item.size > largestFiles[largestFiles.length - 1].size) {
      largestFiles[largestFiles.length - 1] = item;
      largestFiles.sort((a, b) => b.size - a.size);
    }
  };

  // Helper function to recursively sum folder size with safety depth limit
  const getFolderSize = async (dir: string, depth = 0): Promise<number> => {
    // Safety depth limit to prevent infinite loops or huge scans
    if (depth > 6) return 0;

    const dirName = basename(dir).toLowerCase();
    // Skip system/hidden lock folders at top level to avoid huge lag
    if (depth === 1 && ["$recycle.bin", "system volume information", "windows"].includes(dirName)) {
      return 0;
    }

    let folderTotalSize = 0;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const itemPromises = entries.map(async (entry) => {
        const fullPath = join(dir, entry.name);
        
        // Skip symlinks
        if (entry.isSymbolicLink()) return;

        if (entry.isDirectory()) {
          const subSize = await getFolderSize(fullPath, depth + 1);
          folderTotalSize += subSize;
        } else if (entry.isFile()) {
          try {
            const s = await stat(fullPath);
            folderTotalSize += s.size;
            addLargestFile({ name: entry.name, path: fullPath, size: s.size });
          } catch {
            // ignore files that are locked
          }
        }
      });
      await Promise.all(itemPromises);
    } catch {
      // ignore unreadable folders (Access Denied)
    }
    return folderTotalSize;
  };

  try {
    const rootEntries = await readdir(cleanPath, { withFileTypes: true });
    const tasks: (() => Promise<void>)[] = [];

    for (const entry of rootEntries) {
      const fullPath = join(cleanPath, entry.name);
      if (entry.isSymbolicLink()) continue;

      if (entry.isDirectory()) {
        tasks.push(async () => {
          const folderSize = await getFolderSize(fullPath, 1);
          largestFolders.push({
            name: entry.name,
            path: fullPath,
            size: folderSize
          });
        });
      } else if (entry.isFile()) {
        try {
          const s = await stat(fullPath);
          addLargestFile({ name: entry.name, path: fullPath, size: s.size });
        } catch {
          // ignore
        }
      }
    }

    // Run folder sizing tasks with concurrency limit of 4
    await runWithConcurrencyLimit(tasks, 4);
    largestFolders.sort((a, b) => b.size - a.size);

  } catch (err: any) {
    throw new Error(`Failed to scan disk path "${cleanPath}": ${err.message}`);
  }

  return {
    path: cleanPath,
    totalSpaceBytes: totalSpace,
    freeSpaceBytes: freeSpace,
    usedSpaceBytes: totalSpace && freeSpace ? totalSpace - freeSpace : undefined,
    largestFolders: largestFolders.slice(0, 15), // Return top 15 folders
    largestFiles: largestFiles.slice(0, 20)  // Return top 20 files
  };
}
