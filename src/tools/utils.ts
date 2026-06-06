export async function runPowerShell(command: string): Promise<string> {
  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", command]);
  const output = await new Response(proc.stdout).text();
  const error = await new Response(proc.stderr).text();
  
  // A command can succeed and print to stderr (e.g. minor warnings).
  // We only throw if the exit code is non-zero.
  if (proc.exitCode !== 0 && proc.exitCode !== null) {
    throw new Error(`PowerShell Command Failed (exit code ${proc.exitCode}): ${error || output}`);
  }
  return output;
}

export async function runWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();
  
  for (const task of tasks) {
    const p = task().then((res) => {
      results.push(res);
    });
    executing.add(p);
    p.then(() => executing.delete(p));
    
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}
