import { runPowerShell } from "./utils";

interface RawProcess {
  Name: string;
  IDProcess?: number;
  Id?: number; // from fallback Get-Process
  PercentProcessorTime?: number;
  WorkingSetMB: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryMB: number;
}

export async function scanProcesses() {
  const psCmd = `
    try {
        Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -ErrorAction Stop | 
        Where-Object { $_.Name -ne '_Total' -and $_.Name -ne 'Idle' } | 
        Select-Object Name, IDProcess, PercentProcessorTime, @{Name="WorkingSetMB";Expression={[math]::round($_.WorkingSetPrivate / 1MB, 2)}} | 
        ConvertTo-Json -Depth 2
    } catch {
        Get-Process | 
        Select-Object Name, @{Name="IDProcess";Expression={$_.Id}}, @{Name="PercentProcessorTime";Expression={0}}, @{Name="WorkingSetMB";Expression={[math]::round($_.WorkingSet / 1MB, 2)}} | 
        ConvertTo-Json -Depth 2
    }
  `;

  try {
    const rawOutput = await runPowerShell(psCmd);
    if (!rawOutput.trim()) {
      return { processes: [], topCpu: [], topMemory: [] };
    }

    const parsed = JSON.parse(rawOutput.trim());
    const rawProcesses: RawProcess[] = Array.isArray(parsed) ? parsed : [parsed];

    const processes: ProcessInfo[] = rawProcesses
      .filter((p) => p && p.Name)
      .map((p) => {
        // Clean process name (e.g. chrome#1 -> chrome)
        const cleanName = p.Name.split("#")[0];
        const pid = p.IDProcess ?? p.Id ?? 0;
        const cpuPercent = p.PercentProcessorTime ?? 0;
        const memoryMB = p.WorkingSetMB ?? 0;

        return {
          pid,
          name: cleanName,
          cpuPercent,
          memoryMB,
        };
      });

    // Sort top CPU consumers
    const topCpu = [...processes]
      .sort((a, b) => b.cpuPercent - a.cpuPercent)
      .slice(0, 10);

    // Sort top Memory consumers
    const topMemory = [...processes]
      .sort((a, b) => b.memoryMB - a.memoryMB)
      .slice(0, 10);

    return {
      processes: processes.slice(0, 50), // Return a general list of top 50 processes
      topCpu,
      topMemory,
    };
  } catch (err: any) {
    throw new Error(`Failed to scan processes: ${err.message}`);
  }
}
