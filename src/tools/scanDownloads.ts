import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

interface DownloadFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  daysOld: number;
}

interface CategoryStats {
  count: number;
  sizeBytes: number;
}

export async function scanDownloads() {
  const userProfile = process.env.USERPROFILE || "C:\\Users\\Default";
  const downloadsPath = join(userProfile, "Downloads");

  const categories: Record<string, CategoryStats> = {
    Archives: { count: 0, sizeBytes: 0 },
    Executables: { count: 0, sizeBytes: 0 },
    Documents: { count: 0, sizeBytes: 0 },
    Images: { count: 0, sizeBytes: 0 },
    Videos: { count: 0, sizeBytes: 0 },
    Audio: { count: 0, sizeBytes: 0 },
    Others: { count: 0, sizeBytes: 0 },
  };

  let totalSize = 0;
  let totalFiles = 0;
  const allFiles: DownloadFile[] = [];

  const getCategory = (ext: string): string => {
    const extLower = ext.toLowerCase().replace(/^\./, "");
    if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "cab"].includes(extLower)) {
      return "Archives";
    }
    if (["exe", "msi", "bat", "cmd", "ps1", "vbs", "jar"].includes(extLower)) {
      return "Executables";
    }
    if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md", "rtf", "odt"].includes(extLower)) {
      return "Documents";
    }
    if (["png", "jpg", "jpeg", "gif", "svg", "bmp", "webp", "ico", "tif", "tiff"].includes(extLower)) {
      return "Images";
    }
    if (["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "mpeg", "mpg"].includes(extLower)) {
      return "Videos";
    }
    if (["mp3", "wav", "flac", "m4a", "ogg", "wma", "aac"].includes(extLower)) {
      return "Audio";
    }
    return "Others";
  };

  // Asymmetric DFS traversal to find all files under Downloads up to depth 3
  const walk = async (dir: string, depth = 0) => {
    if (depth > 3) return;

    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const promises = entries.map(async (entry) => {
        const fullPath = join(dir, entry.name);
        if (entry.isSymbolicLink()) return;

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          try {
            const s = await stat(fullPath);
            const ext = extname(entry.name);
            const category = getCategory(ext);
            
            categories[category].count += 1;
            categories[category].sizeBytes += s.size;
            
            totalSize += s.size;
            totalFiles += 1;

            const diffTime = Math.abs(Date.now() - s.mtime.getTime());
            const daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            allFiles.push({
              name: entry.name,
              path: fullPath,
              size: s.size,
              lastModified: s.mtime.toISOString(),
              daysOld,
            });
          } catch {
            // Skip file if can't stat
          }
        }
      });
      await Promise.all(promises);
    } catch {
      // Skip directory if permission denied
    }
  };

  try {
    await walk(downloadsPath, 0);

    // Get 10 largest files
    const largestFiles = [...allFiles]
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    // Get 10 largest old files (files > 30 days old)
    const oldFiles = allFiles
      .filter((f) => f.daysOld >= 30)
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    return {
      downloadsPath,
      totalFiles,
      totalSizeBytes: totalSize,
      categories,
      largestFiles,
      oldFiles,
    };
  } catch (err: any) {
    throw new Error(`Failed to scan Downloads folder: ${err.message}`);
  }
}
