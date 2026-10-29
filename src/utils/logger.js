/**
 * Logger utility for clean, colored console outputs
 */

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};

function timestamp() {
  const now = new Date();
  return `${colors.dim}[${now.toLocaleTimeString()}]${colors.reset}`;
}

const logger = {
  info: (msg) => {
    console.log(`${timestamp()} ${colors.cyan}ℹ [INFO]${colors.reset} ${msg}`);
  },
  success: (msg) => {
    console.log(`${timestamp()} ${colors.green}✔ [SUCCESS]${colors.reset} ${msg}`);
  },
  warn: (msg) => {
    console.warn(`${timestamp()} ${colors.yellow}⚠ [WARN]${colors.reset} ${msg}`);
  },
  error: (msg, err) => {
    console.error(`${timestamp()} ${colors.red}✖ [ERROR]${colors.reset} ${msg}`, err || "");
  },
  automod: (msg) => {
    console.log(`${timestamp()} ${colors.magenta}🛡 [AUTOMOD]${colors.reset} ${msg}`);
  },
  stream: (msg) => {
    console.log(`${timestamp()} ${colors.red}🔴 [STREAM]${colors.reset} ${msg}`);
  }
};

module.exports = logger;

