#!/usr/bin/env node
/**
 * Gracefully stops Coordination Manager dev services.
 * Safe for VS Code: excludes Code/Code - Insiders processes.
 *
 * Usage:
 *   node scripts/stop-servers.js          # stop all
 *   node scripts/stop-servers.js web      # stop web only (port 5173)
 *   node scripts/stop-servers.js api      # stop api only (port 3001)
 *   node scripts/stop-servers.js bot      # stop discord bot (port 3002 + command line fallback)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVICE_CONFIG = {
  web: {
    ports: [5173],
    cmdPatterns: ['@coordination-manager/web', '/apps/web/'],
  },
  api: {
    ports: [3001],
    cmdPatterns: ['@coordination-manager/api', '/apps/api/'],
  },
  bot: {
    ports: [3002],
    cmdPatterns: ['discord-bot', '/apps/discord-bot/'],
  },
  guardian: {
    ports: [],
    cmdPatterns: ['discord-guardian', '/apps/discord-guardian/'],
  },
  docs: {
    ports: [5174],
    cmdPatterns: ['@coordination-manager/docs', '/apps/docs/'],
  },
  hmr: {
    ports: [24678],
    cmdPatterns: [],
  },
};

const DEFAULT_TARGETS = ['web', 'api', 'bot', 'guardian', 'docs', 'hmr'];
const STOPPABLE_TARGETS = Object.keys(SERVICE_CONFIG);
const STATE_FILE = path.resolve(__dirname, '..', '..', '.cm-dev-state.json');
const STOP_MARKER_DIR = path.resolve(__dirname, '..', '..', '.cm-stop-markers');

const target = process.argv[2];
if (target && !STOPPABLE_TARGETS.includes(target)) {
  console.error(`Unknown service: ${target}. Valid: ${STOPPABLE_TARGETS.join(', ')}`);
  process.exit(1);
}

const isWindows = process.platform === 'win32';

function buildSelection(selectedTarget) {
  const selectedServices = selectedTarget ? [selectedTarget] : DEFAULT_TARGETS;
  const ports = new Set();
  const cmdlinePatterns = new Set();

  for (const serviceName of selectedServices) {
    const cfg = SERVICE_CONFIG[serviceName];
    for (const port of cfg.ports) ports.add(port);
    for (const pattern of cfg.cmdPatterns) cmdlinePatterns.add(pattern);
  }

  return {
    selectedServices,
    ports: [...ports],
    cmdlinePatterns: [...cmdlinePatterns],
  };
}

function psCommand(command) {
  const encoded = Buffer.from(command, 'utf16le').toString('base64');
  return execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function getVSCodePids() {
  if (!isWindows) return new Set();
  try {
    const out = psCommand("(Get-Process -Name Code, 'Code - Insiders' -ErrorAction SilentlyContinue).Id");
    const pids = new Set();
    for (const line of out.split('\n')) {
      const pid = parseInt(line.trim(), 10);
      if (pid > 0) pids.add(pid);
    }
    return pids;
  } catch {
    return new Set();
  }
}

function getPidsOnPort(port) {
  try {
    if (isWindows) {
      const out = psCommand(`(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess`);
      return [...new Set(
        out.split('\n').map(l => parseInt(l.trim(), 10)).filter(p => p > 0)
      )];
    } else {
      const out = execSync(`lsof -ti :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return [...new Set(
        out.split('\n').map(l => parseInt(l.trim(), 10)).filter(p => p > 0)
      )];
    }
  } catch {
    return [];
  }
}

function gracefulKill(pid) {
  try {
    if (isWindows) {
      execSync(`taskkill /PID ${pid}`, { stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      process.kill(pid, 'SIGTERM');
    }
    return true;
  } catch {
    return false;
  }
}

function forceKill(pid) {
  try {
    if (isWindows) {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch {
    return false;
  }
}

function getPidsByCmdLine(pattern) {
  try {
    if (isWindows) {
      const escaped = pattern.replace(/'/g, "''");
      const out = psCommand(`Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*${escaped}*' } | ForEach-Object { $_.ProcessId }`);
      return [...new Set(
        out.split('\n').map(l => parseInt(l.trim(), 10)).filter(p => p > 0)
      )];
    } else {
      const out = execSync(`pgrep -f "${pattern}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return [...new Set(
        out.split('\n').map(l => parseInt(l.trim(), 10)).filter(p => p > 0)
      )];
    }
  } catch {
    return [];
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const content = fs.readFileSync(STATE_FILE, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function cleanupStateFileIfAll(targetName) {
  if (targetName) return;
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
      console.log(`  Removed state file: ${STATE_FILE}`);
    }
  } catch {
    console.log('  Could not remove state file (non-fatal)');
  }
}

function markIntentionalShutdown(selectedServices) {
  try {
    fs.mkdirSync(STOP_MARKER_DIR, { recursive: true });
    for (const serviceName of selectedServices) {
      const markerPath = path.join(STOP_MARKER_DIR, `${serviceName}.requested`);
      fs.writeFileSync(markerPath, JSON.stringify({
        serviceName,
        requestedAt: new Date().toISOString(),
      }, null, 2), 'utf8');
    }
  } catch {
    // Non-fatal: the service processes still get stopped even if markers cannot be written.
  }
}

function getTrackedShellPids(state, selectedServices) {
  if (!state || !Array.isArray(state.services)) return [];
  const selected = new Set(selectedServices);

  return state.services
    .filter(s => selected.has(s.name))
    .map(s => parseInt(s.launcherPid || s.shellPid, 10))
    .filter(pid => pid > 0);
}

function getTaggedShellPids() {
  if (!isWindows) return [];
  try {
    const out = psCommand("Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { ($_.Name -eq 'powershell.exe' -or $_.Name -eq 'pwsh.exe') -and $_.CommandLine -and ($_.CommandLine -match '\\[(CM|CM-Dev)\\]' -or $_.CommandLine -like '*run-dev-service.ps1*') } | ForEach-Object { $_.ProcessId }");
    return [...new Set(
      out.split('\n').map(line => parseInt(line.trim(), 10)).filter(pid => pid > 0)
    )];
  } catch {
    return [];
  }
}

function getServiceRunnerShellPids(selectedServices) {
  if (!isWindows) return [];
  const matcherMap = {
    web: 'pnpm dev:web',
    api: 'pnpm dev:api',
    bot: 'pnpm dev:bot',
    guardian: 'pnpm dev:guardian',
    docs: 'pnpm dev:docs',
    hmr: '',
  };

  const matchers = selectedServices
    .map(name => matcherMap[name])
    .filter(Boolean);

  try {
    let filterExpr = "$_.CommandLine -like '*run-dev-service.ps1*'";
    if (matchers.length) {
      const cmdFilters = matchers
        .map(m => `$_.CommandLine -like '*${m.replace(/'/g, "''")}*'`)
        .join(' -or ');
      filterExpr = `${filterExpr} -and (${cmdFilters})`;
    }

    const out = psCommand(`Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { ($_.Name -eq 'powershell.exe' -or $_.Name -eq 'pwsh.exe') -and $_.CommandLine -and (${filterExpr}) } | ForEach-Object { $_.ProcessId }`);
    return [...new Set(
      out.split('\n').map(line => parseInt(line.trim(), 10)).filter(pid => pid > 0)
    )];
  } catch {
    return [];
  }
}

async function main() {
  const selection = buildSelection(target);
  const vscodePids = getVSCodePids();

  markIntentionalShutdown(selection.selectedServices);

  if (target) {
    console.log(`Stopping ${target}...`);
  } else {
    console.log('Stopping all dev services...');
  }

  // Phase 1: Collect PIDs and graceful kill
  const allPids = new Set();

  // Port-based services
  for (const port of selection.ports) {
    const pids = getPidsOnPort(port);
    for (const pid of pids) {
      if (vscodePids.has(pid)) continue;
      allPids.add(pid);
      if (gracefulKill(pid)) {
        console.log(`  Graceful stop: PID ${pid} (port ${port})`);
      }
    }
  }

  // Command-line matched services
  for (const pattern of selection.cmdlinePatterns) {
    const pids = getPidsByCmdLine(pattern);
    for (const pid of pids) {
      if (vscodePids.has(pid)) continue;
      allPids.add(pid);
      if (gracefulKill(pid)) {
        console.log(`  Graceful stop: PID ${pid} (cmdline match: ${pattern})`);
      }
    }
  }

  if (allPids.size > 0) {
    // Phase 2: Wait for graceful exit
    await sleep(1500);

    // Phase 3: Force-kill survivors
    for (const port of selection.ports) {
      const pids = getPidsOnPort(port);
      for (const pid of pids) {
        if (vscodePids.has(pid)) continue;
        if (forceKill(pid)) {
          console.log(`  Force stopped: PID ${pid} (port ${port})`);
        }
      }
    }

    // Force-kill command-line matched survivors
    for (const pattern of selection.cmdlinePatterns) {
      const pids = getPidsByCmdLine(pattern);
      for (const pid of pids) {
        if (vscodePids.has(pid)) continue;
        if (forceKill(pid)) {
          console.log(`  Force stopped: PID ${pid} (cmdline match: ${pattern})`);
        }
      }
    }
  } else {
    console.log('No matching dev processes found.');
  }

  // Phase 4: Close only CM service runner shells for the selected services.
  // These are the tabs created by run-dev-service.ps1; closing them removes stale tabs.
  const runnerShellPids = getServiceRunnerShellPids(selection.selectedServices);
  for (const pid of runnerShellPids) {
    if (vscodePids.has(pid)) continue;
    if (forceKill(pid)) {
      console.log(`  Closed service tab shell: PID ${pid}`);
    }
  }

  console.log('Done.');
  cleanupStateFileIfAll(target);
}

main();
