const { execSync, spawn } = require("child_process");
const path = require("path");

// Kill any process using port 3000
try {
  execSync('for /f "tokens=5" %a in (\'netstat -aon ^| findstr ":3000 "\') do taskkill /F /PID %a', {
    shell: true,
    stdio: "ignore",
  });
} catch (e) {}

// Short wait to let the port free up
setTimeout(() => {
  // Start next dev
  const next = spawn("npx", ["next", "dev"], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    shell: true,
  });

  process.on("SIGINT", () => next.kill("SIGINT"));
  process.on("SIGTERM", () => next.kill("SIGTERM"));
}, 800);
