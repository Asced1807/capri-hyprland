// opencode plugin -> Capri.
// Turns opencode's events into the Claude Code hook events Capri already understands and posts
// them to the same local bridge, so she reacts to opencode just like to Claude Code.
// Same rules as the Claude hook: never in the agent's way, only what the display needs,
// 127.0.0.1 only, file contents never sent.
// Installed by `npm run opencode:install` (a one-line stub in ~/.config/opencode/plugin/).

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { launch } = require('../../hooks/launch.js');

const PORT = Number(process.env.CAPRI_PORT) || 47823;
const URL_EVENT = `http://127.0.0.1:${PORT}/event`;
const REPLY_MAX = 6000;
const AGENT = 'opencode';

// opencode tool -> the Claude Code tool Capri knows how to describe
const TOOLS = {
  bash: 'Bash', read: 'Read', write: 'Write', edit: 'Edit', multiedit: 'MultiEdit', patch: 'Edit',
  apply_patch: 'Edit', grep: 'Grep', glob: 'Glob', list: 'Glob', webfetch: 'WebFetch',
  websearch: 'WebSearch', task: 'Agent', todowrite: 'TodoWrite', todoread: 'TodoWrite',
  skill: 'Skill', question: 'AskUserQuestion',
};

const clip = (v, n = 280) => (typeof v === 'string' && v.length > n ? v.slice(0, n) + '…' : v);

// only what describe() reads, renamed the Claude way; never contents
function toolInput(tool, args = {}) {
  const file = args.filePath ?? args.file_path ?? args.path;
  return {
    file_path: clip(file),
    command: clip(args.command),
    description: clip(args.description),
    pattern: clip(tool === 'list' ? (args.path ?? '.') : args.pattern),
    url: clip(args.url),
    query: clip(args.query),
    subagent_type: clip(args.subagent_type ?? args.subagentType),
    skill: clip(args.name ?? args.skill),
    content_len: typeof args.content === 'string' ? args.content.length : undefined,
  };
}

const textOf = (parts = []) => parts.filter((p) => p?.type === 'text' && !p.synthetic).map((p) => p.text).join('\n').trim();

export const CapriPlugin = async ({ client, directory }) => {
  const cwd = directory;
  let launched = false;

  async function post(evt) {
    const body = JSON.stringify({ capri_agent: AGENT, cwd, ...evt });
    try {
      await fetch(URL_EVENT, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(800),
      });
    } catch {
      // she isn't running: bring her up once, on the first event that finds her missing
      if (!launched) {
        launched = true;
        try {
          launch();
        } catch {
          // never in opencode's way
        }
      }
    }
  }
  const send = (evt) => { post(evt); }; // fire and forget
  const sessions = new Set(); // seen here, ended when opencode shuts down

  // the last thing the assistant said in a session, for the "done" panel
  async function lastReply(sessionID) {
    try {
      const res = await client.session.messages({ path: { id: sessionID } });
      const messages = res?.data ?? res ?? [];
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.info?.role !== 'assistant') continue;
        const text = textOf(m.parts);
        if (text) return text.length > REPLY_MAX ? text.slice(0, REPLY_MAX) + '…' : text;
      }
    } catch {
      // no reply to show
    }
    return undefined;
  }

  send({ hook_event_name: 'SessionStart', session_id: 'opencode', source: 'startup' });

  return {
    'chat.message': async (input, output) => {
      sessions.add(input.sessionID);
      send({ hook_event_name: 'UserPromptSubmit', session_id: input.sessionID, prompt: clip(textOf(output.parts)) });
    },

    'tool.execute.before': async (input, output) => {
      send({
        hook_event_name: 'PreToolUse', session_id: input.sessionID, tool_use_id: input.callID,
        tool_name: TOOLS[input.tool] ?? input.tool, tool_input: toolInput(input.tool, output.args),
      });
    },

    'tool.execute.after': async (input, output) => {
      const exit = output?.metadata?.exit;
      const failed = input.tool === 'bash' && typeof exit === 'number' && exit !== 0;
      const evt = {
        hook_event_name: failed ? 'PostToolUseFailure' : 'PostToolUse', session_id: input.sessionID,
        tool_use_id: input.callID, tool_name: TOOLS[input.tool] ?? input.tool, tool_input: toolInput(input.tool, input.args),
      };
      if (failed) evt.error = clip(String(output.output ?? '').trim().split('\n').slice(-3).join('\n'));
      send(evt);
    },

    event: async ({ event }) => {
      const p = event?.properties ?? {};
      switch (event?.type) {
        case 'permission.asked':
        case 'permission.updated':
          send({
            hook_event_name: 'Notification', session_id: p.sessionID, notification_type: 'permission_prompt',
            message: clip(p.title ?? p.permission ?? 'permission'),
          });
          break;
        case 'session.idle':
          send({ hook_event_name: 'Stop', session_id: p.sessionID, last_assistant_message: await lastReply(p.sessionID) });
          break;
        case 'session.error':
          if (p.error?.name === 'MessageAbortedError') send({ hook_event_name: 'Stop', session_id: p.sessionID, is_interrupt: true });
          else send({ hook_event_name: 'StopFailure', session_id: p.sessionID, error: clip(p.error?.data?.message ?? p.error?.name) });
          break;
        case 'session.compacted':
          send({ hook_event_name: 'PreCompact', session_id: p.sessionID });
          break;
        case 'server.instance.disposed': // opencode is closing
          for (const id of sessions) send({ hook_event_name: 'SessionEnd', session_id: id });
          sessions.clear();
          break;
        case 'session.deleted':
          send({ hook_event_name: 'SessionEnd', session_id: p.info?.id ?? p.sessionID });
          break;
        default:
      }
    },
  };
};
