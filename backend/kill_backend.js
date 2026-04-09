const { execSync } = require('child_process');
try {
  const output = execSync('netstat -ano | findstr :3001').toString();
  const lines = output.split('\n').filter(l => l.includes('LISTENING'));
  if (lines.length > 0) {
    const pid = lines[0].trim().split(/\s+/).pop();
    console.log(`Killing PID ${pid}`);
    execSync(`taskkill /F /PID ${pid}`);
  }
} catch (e) {
  console.log('Not running or error:', e.message);
}
