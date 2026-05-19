'use strict';

const HISTORY_LIMIT = 100;
const MIN_COUNTDOWN_SECONDS = 60;
const MAX_COUNTDOWN_SECONDS = 900;
const RCON_PREFIXES = new Set(['/', '\\']);
const ACTION_UPDATE_FLAGS = new Set(['start', 'restart', 'safe_restart']);

const HELP_TEXT = [
  'RCON commands:',
  '  /servermsg "Hello survivors"',
  '  \\servermsg "Hello survivors"',
  '',
  'Portal commands:',
  '  !help',
  '  !history clear',
  '  !start [-c|--check-updates]',
  '  !stop [-u|--unsafe] [-t|--countdown-seconds 300]',
  '  !restart [-u|--unsafe] [-c|--check-updates] [-t|--countdown-seconds 300]'
].join('\n');

class TerminalInputError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'TerminalInputError';
    this.statusCode = statusCode;
  }
}

function terminalOwnerKey(user) {
  if (user?.provider === 'local' && user.userId) {
    return `local:${user.userId}`;
  }

  const provider = user?.provider || 'unknown';
  const subject = user?.subject || user?.username || 'unknown';
  return `${provider}:${subject}`;
}

function publicTerminalEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    username: entry.username,
    input: entry.input,
    kind: entry.kind,
    status: entry.status,
    command: entry.command || '',
    stdout: entry.stdout || '',
    stderr: entry.stderr || '',
    message: entry.message || '',
    code: Number.isInteger(entry.code) ? entry.code : null,
    signal: entry.signal || null,
    createdAt: entry.createdAt
  };
}

function terminalEntry({
  input,
  kind,
  status = 'completed',
  command = '',
  stdout = '',
  stderr = '',
  message = '',
  code = null,
  signal = null
}) {
  return {
    input,
    kind,
    status,
    command,
    stdout,
    stderr,
    message,
    code: Number.isInteger(code) ? code : null,
    signal: signal || null
  };
}

function commandName(commandLine) {
  return String(commandLine || '').trim().replace(/^\//, '').split(/\s+/)[0] || 'unknown';
}

function splitPortalTokens(input) {
  return String(input || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function parseFlags(args, allowed) {
  const flags = {
    unsafe: false,
    checkUpdates: false,
    countdownSeconds: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '-u' || arg === '--unsafe') {
      if (!allowed.has('unsafe')) {
        throw new TerminalInputError(`${arg} is not supported for this command.`);
      }
      flags.unsafe = true;
      continue;
    }

    if (arg === '-c' || arg === '--check-updates') {
      if (!allowed.has('checkUpdates')) {
        throw new TerminalInputError(`${arg} is not supported for this command.`);
      }
      flags.checkUpdates = true;
      continue;
    }

    if (arg === '-t' || arg === '--countdown-seconds') {
      if (!allowed.has('countdownSeconds')) {
        throw new TerminalInputError(`${arg} is not supported for this command.`);
      }
      index += 1;
      const value = args[index];
      if (!value || value.startsWith('-')) {
        throw new TerminalInputError(`${arg} requires a countdown value in seconds.`);
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed !== Number(value)) {
        throw new TerminalInputError('Countdown must be a whole number of seconds.');
      }
      if (parsed < MIN_COUNTDOWN_SECONDS || parsed > MAX_COUNTDOWN_SECONDS) {
        throw new TerminalInputError(
          `Countdown must be between ${MIN_COUNTDOWN_SECONDS} and ${MAX_COUNTDOWN_SECONDS} seconds.`
        );
      }
      flags.countdownSeconds = parsed;
      continue;
    }

    throw new TerminalInputError(`Unsupported argument [${arg}].`);
  }

  return flags;
}

function parsePortalCommand(input) {
  const tokens = splitPortalTokens(input.slice(1));
  const name = (tokens.shift() || '').toLowerCase();

  if (!name || name === 'help') {
    if (tokens.length > 0) {
      throw new TerminalInputError('!help does not accept arguments.');
    }
    return { type: 'help' };
  }

  if (name === 'history') {
    const subcommand = (tokens.shift() || '').toLowerCase();
    if (subcommand === 'clear' && tokens.length === 0) {
      return { type: 'clearHistory' };
    }
    throw new TerminalInputError('Use !history clear to clear terminal history.');
  }

  if (name === 'start') {
    const flags = parseFlags(tokens, new Set(['checkUpdates']));
    return {
      type: 'action',
      action: 'start',
      checkUpdates: flags.checkUpdates
    };
  }

  if (name === 'stop') {
    const flags = parseFlags(tokens, new Set(['unsafe', 'countdownSeconds']));
    if (flags.unsafe && flags.countdownSeconds !== null) {
      throw new TerminalInputError('Countdown seconds only apply to safe stop. Remove --unsafe to use a countdown.');
    }
    return {
      type: 'action',
      action: flags.unsafe ? 'stop' : 'safe_stop',
      checkUpdates: false,
      countdownSeconds: flags.countdownSeconds
    };
  }

  if (name === 'restart') {
    const flags = parseFlags(tokens, new Set(['unsafe', 'checkUpdates', 'countdownSeconds']));
    if (flags.unsafe && flags.countdownSeconds !== null) {
      throw new TerminalInputError('Countdown seconds only apply to safe restart. Remove --unsafe to use a countdown.');
    }
    return {
      type: 'action',
      action: flags.unsafe ? 'restart' : 'safe_restart',
      checkUpdates: flags.checkUpdates,
      countdownSeconds: flags.countdownSeconds
    };
  }

  throw new TerminalInputError(`Unknown portal command [!${name}]. Use !help for supported commands.`);
}

function actionMessage(action, checkUpdates) {
  const label = {
    start: 'Start',
    stop: 'Immediate stop',
    restart: 'Immediate restart',
    safe_stop: 'Safe stop',
    safe_restart: 'Safe restart'
  }[action] || action;

  return `${label}${checkUpdates && ACTION_UPDATE_FLAGS.has(action) ? ' with update check' : ''} completed`;
}

function countdownMessage(countdownSeconds) {
  if (!Number.isFinite(countdownSeconds)) {
    return '';
  }
  const minutes = countdownSeconds / 60;
  return ` with ${minutes} minute${minutes === 1 ? '' : 's'} of player warnings`;
}

function safeActionUnavailable(action, controller) {
  if (action !== 'safe_stop' && action !== 'safe_restart') {
    return '';
  }

  const status = typeof controller.getStatus === 'function' ? controller.getStatus() : null;
  if (status?.capabilities?.rcon) {
    return '';
  }

  return `${action === 'safe_stop' ? '!stop' : '!restart'} needs RCON for player warnings. Use --unsafe to run it immediately.`;
}

async function runRconTerminalCommand({ input, commandLine, user, controller, db }) {
  const name = commandName(commandLine);
  try {
    db.recordAction(user.username, 'rcon_command', 'started', `command: ${name}`, 'operator');
    const result = await controller.runRconCommandLine(commandLine);
    db.recordAction(user.username, 'rcon_command', 'completed', `command: ${name}`, 'operator');
    return terminalEntry({
      input,
      kind: 'rcon',
      status: 'completed',
      command: result.commandLine || commandLine,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      code: result.code,
      signal: result.signal
    });
  } catch (error) {
    db.recordAction(user.username, 'rcon_command', 'failed', `command: ${name}`, 'operator');
    const result = error.result || {};
    return terminalEntry({
      input,
      kind: 'rcon',
      status: 'failed',
      command: result.commandLine || commandLine,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      message: error.message,
      code: result.code,
      signal: result.signal
    });
  }
}

async function runPortalAction({ input, parsed, user, controller, db }) {
  const unavailable = safeActionUnavailable(parsed.action, controller);
  if (unavailable) {
    db.recordAction(user.username, parsed.action, 'failed', unavailable, 'admin');
    return terminalEntry({
      input,
      kind: 'portal',
      status: 'failed',
      command: parsed.action,
      message: unavailable
    });
  }

  try {
    db.recordAction(user.username, parsed.action, 'started', '', 'admin');
    await controller.runAction(parsed.action, user, {
      checkUpdates: parsed.checkUpdates,
      countdownSeconds: parsed.countdownSeconds
    });
    db.recordAction(user.username, parsed.action, 'completed', '', 'admin');
    return terminalEntry({
      input,
      kind: 'portal',
      status: 'completed',
      command: parsed.action,
      message: `${actionMessage(parsed.action, parsed.checkUpdates)}${countdownMessage(parsed.countdownSeconds)}.`
    });
  } catch (error) {
    db.recordAction(user.username, parsed.action, 'failed', error.message, 'admin');
    return terminalEntry({
      input,
      kind: 'portal',
      status: 'failed',
      command: parsed.action,
      message: error.message
    });
  }
}

async function runPortalCommand({ input, parsed, user, controller, db, ownerKey }) {
  if (parsed.type === 'clearHistory') {
    db.clearTerminalHistory(ownerKey);
    return {
      cleared: true,
      message: 'Terminal history cleared.'
    };
  }

  if (parsed.type === 'help') {
    return {
      entry: terminalEntry({
        input,
        kind: 'portal',
        status: 'completed',
        command: 'help',
        message: HELP_TEXT
      })
    };
  }

  if (parsed.type === 'action') {
    return {
      entry: await runPortalAction({ input, parsed, user, controller, db })
    };
  }

  throw new TerminalInputError('Unsupported portal command.');
}

async function runTerminalCommand({ input, user, controller, db }) {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    throw new TerminalInputError('Enter a terminal command.');
  }

  const ownerKey = terminalOwnerKey(user);
  let result;

  if (RCON_PREFIXES.has(trimmed[0])) {
    const commandLine = trimmed.slice(1).trimStart();
    if (!commandLine) {
      result = {
        entry: terminalEntry({
          input: trimmed,
          kind: 'rcon',
          status: 'failed',
          message: 'Enter an RCON command after the prefix.'
        })
      };
    } else {
      result = {
        entry: await runRconTerminalCommand({
          input: trimmed,
          commandLine,
          user,
          controller,
          db
        })
      };
    }
  } else if (trimmed.startsWith('!')) {
    try {
      result = await runPortalCommand({
        input: trimmed,
        parsed: parsePortalCommand(trimmed),
        user,
        controller,
        db,
        ownerKey
      });
    } catch (error) {
      result = {
        entry: terminalEntry({
          input: trimmed,
          kind: 'portal',
          status: 'failed',
          message: error.message
        })
      };
    }
  } else {
    result = {
      entry: terminalEntry({
        input: trimmed,
        kind: 'system',
        status: 'failed',
        message: 'Prefix RCON commands with / or \\ and portal commands with !. Use !help for examples.'
      })
    };
  }

  if (!result.cleared && result.entry) {
    return {
      entry: publicTerminalEntry(db.recordTerminalEntry(ownerKey, user.username, result.entry, HISTORY_LIMIT))
    };
  }

  return result;
}

module.exports = {
  HELP_TEXT,
  HISTORY_LIMIT,
  TerminalInputError,
  parsePortalCommand,
  publicTerminalEntry,
  runTerminalCommand,
  terminalOwnerKey
};
