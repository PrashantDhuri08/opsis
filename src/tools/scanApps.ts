import { runPowerShell } from "./utils";

interface RawApp {
  DisplayName: string;
  DisplayVersion?: string;
  Publisher?: string;
  InstallDate?: string;
  SizeMB?: number | null;
}

export interface AppInfo {
  name: string;
  version: string;
  publisher: string;
  installDate: string;
  sizeMB: number | null;
}

export async function scanApps() {
  const psCmd = `
    $regPaths = @(
        "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
        "HKLM:\\SOFTWARE\\Wow6432Node\\Microsoft\Windows\\CurrentVersion\\Uninstall\\*",
        "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
    )
    Get-ItemProperty -Path $regPaths -ErrorAction SilentlyContinue | 
        Where-Object { $_.DisplayName -ne $null } | 
        Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, @{Name="SizeMB";Expression={if ($_.EstimatedSize) { [math]::round($_.EstimatedSize / 1024, 2) } else { $null }}} | 
        ConvertTo-Json -Depth 2
  `;

  try {
    const rawOutput = await runPowerShell(psCmd);
    if (!rawOutput.trim()) {
      return [];
    }

    const parsed = JSON.parse(rawOutput.trim());
    const rawApps: RawApp[] = Array.isArray(parsed) ? parsed : [parsed];

    const appsMap = new Map<string, AppInfo>();

    for (const app of rawApps) {
      if (!app || !app.DisplayName) continue;

      const name = app.DisplayName.trim();
      const version = app.DisplayVersion?.trim() || "Unknown";
      const publisher = app.Publisher?.trim() || "Unknown";
      let installDate = app.InstallDate?.trim() || "Unknown";

      // Normalize InstallDate if it is in YYYYMMDD format
      if (installDate.match(/^\d{8}$/)) {
        installDate = `${installDate.substring(0, 4)}-${installDate.substring(4, 6)}-${installDate.substring(6, 8)}`;
      }

      const sizeMB = app.SizeMB ?? null;

      // Deduplicate by application name, keeping the one with size if available
      const existing = appsMap.get(name);
      if (!existing || (sizeMB !== null && existing.sizeMB === null)) {
        appsMap.set(name, {
          name,
          version,
          publisher,
          installDate,
          sizeMB,
        });
      }
    }

    const appsList = Array.from(appsMap.values());
    
    // Sort by name alphabetically
    appsList.sort((a, b) => a.name.localeCompare(b.name));

    return appsList;
  } catch (err: any) {
    throw new Error(`Failed to scan installed applications: ${err.message}`);
  }
}
