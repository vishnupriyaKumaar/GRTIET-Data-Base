// Opens the app in the computer's normal browser (only when RUN.bat asks for it).
const { spawn } = require('child_process');

function openDefault(url) {
  try {
    if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  } catch { /* ignore */ }
}

module.exports = { openDefault };
