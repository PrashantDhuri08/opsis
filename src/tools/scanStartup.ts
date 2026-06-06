import { runPowerShell } from "./utils";

interface RawStartup {
  Name: string;
  Command: string;
  Location: string;
  User?: string;
}

export interface StartupInfo {
  name: string;
  command: string;
  location: string;
  user: string;
}

export async function scanStartup() {
  const psCmd = `
    try {
        Get-CimInstance -ClassName Win32_StartupCommand -ErrorAction Stop | 
        Select-Object Name, Command, Location, User | 
        ConvertTo-Json -Depth 2
    } catch {
        $runPaths = @(
            "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run",
            "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"
        )
        $apps = foreach ($path in $runPaths) {
            if (Test-Path $path) {
                Get-ItemProperty -Path $path | 
                Get-Member -MemberType NoteProperty | 
                Where-Object { $_.Name -notmatch "PS" } | 
                ForEach-Object {
                    [PSCustomObject]@{
                        Name = $_.Name
                        Command = (Get-ItemProperty -Path $path).($_.Name)
                        Location = $path
                        User = "CurrentUser"
                    }
                }
            }
        }
        if ($apps) {
            $apps | ConvertTo-Json -Depth 2
        } else {
            "[]"
        }
    }
  `;

  try {
    const rawOutput = await runPowerShell(psCmd);
    if (!rawOutput.trim() || rawOutput.trim() === "[]") {
      return [];
    }

    const parsed = JSON.parse(rawOutput.trim());
    const rawStartups: RawStartup[] = Array.isArray(parsed) ? parsed : [parsed];

    const startups: StartupInfo[] = rawStartups
      .filter((s) => s && s.Name)
      .map((s) => ({
        name: s.Name.trim(),
        command: s.Command?.trim() || "Unknown",
        location: s.Location?.trim() || "Unknown",
        user: s.User?.trim() || "All Users",
      }));

    return startups;
  } catch (err: any) {
    throw new Error(`Failed to scan startup items: ${err.message}`);
  }
}
