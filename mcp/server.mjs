#!/usr/bin/env node
/**
 * Astryx MCP server.
 *
 * Exposes the installed Astryx CLI as typed, read-only tools over stdio.
 * No tool writes to disk. Inside a project the project's own CLI answers;
 * outside one it falls back to the pinned release through npx.
 *
 * Tools: astryx_search, astryx_component, astryx_docs, astryx_templates,
 * astryx_themes, astryx_build, astryx_doctor, astryx_manifest.
 */
import {spawn} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';

const SERVER_NAME = 'astryx';
const SERVER_VERSION = '0.1.0';
const PKG = '@astryxdesign/cli';
const PINNED_VERSION = process.env.ASTRYX_CLI_VERSION || '0.7.14';
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_STDOUT = 6_000_000;
const MAX_STDERR = 200_000;
const SUPPORTED_PROTOCOLS = ['2024-11-05', '2025-03-26', '2025-06-18'];

const log = (message) => process.stderr.write(`[astryx-mcp] ${message}\n`);

// --- CLI resolution -------------------------------------------------------

function findLocalCli(startDir) {
  let dir = resolve(startDir);
  for (;;) {
    const pkgPath = join(dir, 'node_modules', '@astryxdesign', 'cli', 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        const bin = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin?.astryx ?? pkg.bin?.cli);
        if (bin) {
          const entry = join(dirname(pkgPath), bin);
          if (existsSync(entry)) return {entry, version: pkg.version, root: dir};
        }
      } catch (error) {
        log(`ignoring unreadable ${pkgPath}: ${error.message}`);
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function npxEntry() {
  const nodeDir = dirname(process.execPath);
  const candidates = [
    join(nodeDir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ];
  return candidates.find(existsSync) ?? null;
}

function resolveInvocation() {
  const explicit = process.env.ASTRYX_CLI;
  if (explicit) return {command: explicit, baseArgs: [], label: explicit};

  const local = findLocalCli(process.env.ASTRYX_PROJECT_DIR || process.cwd());
  if (local) {
    return {
      command: process.execPath,
      baseArgs: [local.entry],
      label: `${PKG}@${local.version} (project)`,
    };
  }

  const npx = npxEntry();
  if (npx) {
    return {
      command: process.execPath,
      baseArgs: [npx, '-y', `${PKG}@${PINNED_VERSION}`],
      label: `${PKG}@${PINNED_VERSION} (npx)`,
    };
  }

  if (process.platform === 'win32') {
    return {
      command: 'cmd',
      baseArgs: ['/d', '/c', 'npx', '-y', `${PKG}@${PINNED_VERSION}`],
      label: `${PKG}@${PINNED_VERSION} (npx)`,
    };
  }
  return {
    command: 'npx',
    baseArgs: ['-y', `${PKG}@${PINNED_VERSION}`],
    label: `${PKG}@${PINNED_VERSION} (npx)`,
  };
}

// --- Execution ------------------------------------------------------------

function runCli(args, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const invocation = resolveInvocation();
  return new Promise((settle) => {
    let child;
    try {
      child = spawn(invocation.command, [...invocation.baseArgs, ...args], {
        cwd: process.env.ASTRYX_PROJECT_DIR || process.cwd(),
        env: {...process.env, NO_COLOR: '1', FORCE_COLOR: '0'},
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      settle({ok: false, stdout: '', stderr: error.message, label: invocation.label});
      return;
    }

    let stdout = '';
    let stderr = '';
    let finished = false;
    let truncated = false;

    const timer = setTimeout(() => {
      if (!finished) {
        stderr += `\nastryx mcp: command timed out after ${timeoutMs}ms`;
        child.kill();
      }
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      if (stdout.length < MAX_STDOUT) stdout += chunk;
      else truncated = true;
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < MAX_STDERR) stderr += chunk;
    });

    const finish = (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      settle({
        ok: code === 0,
        code,
        stdout,
        stderr,
        label: invocation.label,
        truncated,
      });
    };

    child.on('error', (error) => {
      stderr += `\nastryx mcp: ${error.message}`;
      finish(null);
    });
    child.on('close', finish);
  });
}

async function runJson(args, timeoutMs) {
  const result = await runCli([...args, '--json'], timeoutMs);
  if (!result.ok) {
    let detail = (result.stdout.trim() || result.stderr.trim() || 'unknown failure').slice(0, 2_000);
    try {
      const envelope = JSON.parse(result.stdout);
      if (envelope?.error) {
        detail = [
          envelope.error,
          envelope.code ? `code=${envelope.code}` : null,
          Array.isArray(envelope.suggestions) && envelope.suggestions.length
            ? `suggestions: ${envelope.suggestions.join('; ')}`
            : null,
        ]
          .filter(Boolean)
          .join(' | ');
      }
    } catch {
      // stdout was not the JSON error envelope; keep the text detail.
    }
    throw new Error(`astryx ${args.join(' ')} failed: ${detail}`);
  }
  if (result.truncated) throw new Error('astryx output exceeded the 6 MB cap');
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`astryx ${args.join(' ')} returned non-JSON output: ${result.stdout.slice(0, 600)}`);
  }
}

// --- Shaping --------------------------------------------------------------

const clip = (value, max) =>
  typeof value === 'string' && value.length > max ? `${value.slice(0, max - 1)}…` : value;

function compactSearch(envelope, limit) {
  const data = envelope.data ?? {};
  return {
    query: data.query,
    matchCount: data.matchCount,
    results: (data.results ?? []).slice(0, limit).map((item) => ({
      domain: item.domain,
      name: item.name,
      package: item.package,
      import: item.import,
      command: item.command,
      score: item.score,
      description: clip(item.description, 300),
    })),
  };
}

function compactComponent(data, includeExamples) {
  return {
    name: data.name,
    category: data.category,
    group: data.group,
    import: data.import,
    package: data.package,
    keywords: data.keywords,
    usage: data.usage,
    props: data.props,
    theming: data.theming,
    examples: includeExamples ? data.examples : undefined,
  };
}

function compactTemplateShow(data, includeSource) {
  return {
    template: data.template,
    description: data.description,
    type: data.type,
    components: data.components,
    source: includeSource ? data.source : undefined,
  };
}

function compactBuild(data, limit) {
  const start = data.start;
  return {
    query: data.query,
    hasResults: data.hasResults,
    directMatch: data.directMatch,
    start: start
      ? {
          name: start.name,
          displayName: start.displayName,
          description: start.description,
          command: start.command,
          basis: start.basis,
          reason: start.reason,
          alternatives: (start.alternatives ?? []).slice(0, limit).map((item) => ({
            name: item.name,
            displayName: item.displayName,
            description: clip(item.description, 240),
          })),
        }
      : null,
  };
}

function compactDoctor(data) {
  const checks = data.checks ?? [];
  const failures = checks.filter((check) => check.status !== 'pass');
  return {
    status: failures.length === 0 ? 'pass' : 'attention',
    checkCount: checks.length,
    failures: failures.map((check) => ({
      id: check.id,
      status: check.status,
      message: check.message,
    })),
    checks: checks.map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status,
      message: clip(check.message, 500),
    })),
  };
}

function compactManifest(envelope, commandName) {
  const data = envelope.data ?? {};
  const commands = data.commands ?? [];
  if (commandName) {
    const command = commands.find((item) => item.name === commandName);
    if (!command) {
      throw new Error(
        `unknown astryx command "${commandName}"; known: ${commands.map((item) => item.name).join(', ')}`,
      );
    }
    return command;
  }
  return {
    name: data.name,
    version: data.version,
    apiVersion: data.apiVersion,
    description: data.description,
    globalOptions: data.globalOptions,
    commands: commands.map((command) => ({
      name: command.name,
      description: command.description,
      json: command.json,
      outsideProject: command.outsideProject,
    })),
  };
}

// --- Tool catalog ---------------------------------------------------------

const tools = [
  {
    name: 'astryx_search',
    description:
      'Search Astryx components, hooks, docs topics, templates, and themes in one ranked list. Use this first when you do not know the exact component name.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {type: 'string', description: 'What you need, e.g. "loading destructive button"'},
        limit: {type: 'integer', minimum: 1, maximum: 20, default: 8},
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'astryx_component',
    description:
      'Read a component’s authoritative API for the installed Astryx version: import path, props, variants, theming targets, usage, and accessibility. Use before writing or changing any Astryx component.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {type: 'string', description: 'Component name, e.g. Button'},
        lang: {type: 'string', enum: ['en', 'zh'], default: 'en'},
        includeExamples: {
          type: 'boolean',
          default: false,
          description: 'Include code examples, which add substantial output',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'astryx_docs',
    description:
      'Read an Astryx docs topic, optionally one section. Useful topics: getting-started, theme, use-a-theme, author-a-theme, tokens, styling, migration, is-my-code-good.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {type: 'string', description: 'Topic, e.g. "theme" or "migration/migration-setup"'},
        section: {type: 'string', description: 'Optional section id within the topic'},
      },
      required: ['topic'],
      additionalProperties: false,
    },
  },
  {
    name: 'astryx_templates',
    description:
      'List Astryx page/block templates, or show one template’s description and required components. Prefer starting a page from a template over a blank file.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {type: 'string', description: 'Template id; omit to list all'},
        includeSource: {
          type: 'boolean',
          default: false,
          description: 'Return the template’s scaffold source (large)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'astryx_themes',
    description:
      'List Astryx themes with slug, description, and whether each is added or the app default. Run before choosing or overriding a theme.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
  },
  {
    name: 'astryx_build',
    description:
      'Recommend a starting template and workflow for a page idea. Returns the best template, its scaffold command, and alternatives.',
    inputSchema: {
      type: 'object',
      properties: {
        idea: {type: 'string', description: 'Page idea, e.g. "analytics dashboard"'},
        limit: {type: 'integer', minimum: 0, maximum: 10, default: 3},
      },
      required: ['idea'],
      additionalProperties: false,
    },
  },
  {
    name: 'astryx_doctor',
    description:
      'Diagnose the Astryx setup in the current project: answering CLI/Core versions, CSS imports, theme wiring, and configuration problems.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false},
  },
  {
    name: 'astryx_manifest',
    description:
      'Machine-readable Astryx CLI capability manifest. Summarizes every command, or returns one command’s full definition including options and response types.',
    inputSchema: {
      type: 'object',
      properties: {
        command: {type: 'string', description: 'Optional command name, e.g. "component"'},
      },
      additionalProperties: false,
    },
  },
];

for (const tool of tools) {
  tool.annotations = {readOnlyHint: true, destructiveHint: false, openWorldHint: false};
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'astryx_search':
      return compactSearch(await runJson(['search', String(args.query)]), args.limit ?? 8);
    case 'astryx_component': {
      const langArgs = args.lang === 'zh' ? ['--zh'] : [];
      const envelope = await runJson([...langArgs, 'component', String(args.name)]);
      return compactComponent(envelope.data ?? {}, Boolean(args.includeExamples));
    }
    case 'astryx_docs': {
      const path = [args.topic, args.section].filter(Boolean).map(String);
      const envelope = await runJson(['docs', ...path]);
      return envelope.data ?? envelope;
    }
    case 'astryx_templates': {
      if (args.name) {
        const envelope = await runJson(['template', String(args.name)]);
        return compactTemplateShow(envelope.data ?? {}, Boolean(args.includeSource));
      }
      const envelope = await runJson(['template', '--list']);
      return (envelope.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        description: clip(item.description, 300),
        type: item.type,
        category: item.category,
        isReady: item.isReady,
        scaffold: item.scaffold,
      }));
    }
    case 'astryx_themes': {
      const envelope = await runJson(['theme', 'list']);
      return (envelope.data ?? []).map((item) => ({
        slug: item.slug,
        displayName: item.displayName,
        description: clip(item.description, 240),
        added: item.added,
        default: item.default,
        package: item.package,
      }));
    }
    case 'astryx_build': {
      const envelope = await runJson(['build', String(args.idea)]);
      return compactBuild(envelope.data ?? {}, args.limit ?? 3);
    }
    case 'astryx_doctor': {
      const envelope = await runJson(['doctor']);
      return compactDoctor(envelope.data ?? {});
    }
    case 'astryx_manifest': {
      const envelope = await runJson(['manifest']);
      return compactManifest(envelope, args.command ? String(args.command) : undefined);
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// --- JSON-RPC over stdio --------------------------------------------------

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({jsonrpc: '2.0', id, result});
}

function replyError(id, code, message) {
  send({jsonrpc: '2.0', id, error: {code, message}});
}

async function handle(message) {
  const {id, method, params} = message;
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case 'initialize': {
        const requested = params?.protocolVersion;
        const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested)
          ? requested
          : SUPPORTED_PROTOCOLS[0];
        reply(id, {
          protocolVersion,
          capabilities: {tools: {listChanged: false}},
          serverInfo: {name: SERVER_NAME, version: SERVER_VERSION},
          instructions:
            'Astryx design system. Call astryx_search before choosing a component, astryx_component before writing one, and astryx_doctor before delivering.',
        });
        return;
      }
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return;
      case 'ping':
        reply(id, {});
        return;
      case 'tools/list':
        reply(id, {tools});
        return;
      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments ?? {};
        if (typeof toolName !== 'string') {
          replyError(id, -32602, 'tools/call requires a tool name');
          return;
        }
        try {
          const result = await callTool(toolName, toolArgs);
          reply(id, {
            content: [{type: 'text', text: JSON.stringify(result, null, 2)}],
            isError: false,
          });
        } catch (error) {
          reply(id, {
            content: [{type: 'text', text: error.message}],
            isError: true,
          });
        }
        return;
      }
      default:
        if (isNotification) return;
        replyError(id, -32601, `method not found: ${method}`);
    }
  } catch (error) {
    log(`unhandled error on ${method}: ${error.stack ?? error.message}`);
    if (!isNotification) replyError(id, -32603, error.message);
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  for (;;) {
    const newline = buffer.indexOf('\n');
    if (newline < 0) break;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      log('dropping malformed JSON-RPC line');
      continue;
    }
    void handle(message);
  }
});

process.stdin.on('end', () => process.exit(0));
process.on('uncaughtException', (error) => log(`uncaught: ${error.stack ?? error.message}`));
process.on('unhandledRejection', (error) => log(`unhandled rejection: ${error}`));
