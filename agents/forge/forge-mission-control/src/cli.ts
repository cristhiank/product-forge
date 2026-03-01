#!/usr/bin/env node

import { Command } from 'commander';
import { discover } from './discovery.js';
import { createServer } from './server.js';
import open from 'open';

const program = new Command();

program
  .name('forge-ui')
  .description('Forge Mission Control — local web dashboard for your project')
  .version('0.1.0')
  .argument('[path]', 'Repository root path', process.cwd())
  .option('-p, --port <number>', 'Port number', '3700')
  .option('--no-open', 'Don\'t auto-open browser')
  .option('--verbose', 'Show server logs')
  .action(async (repoPath: string, opts: { port: string; open: boolean; verbose: boolean }) => {
    const port = parseInt(opts.port, 10);

    console.log('🔥 Forge Mission Control');
    console.log(`   Scanning: ${repoPath}\n`);

    const discovery = await discover(repoPath);

    if (discovery.systems.length === 0) {
      console.error('❌ No Forge systems found at this path.');
      console.error('   Expected at least one of: .product/, .backlog/, .git/devpartner/, .copilot-workers/');
      process.exit(1);
    }

    console.log('   Discovered:');
    for (const sys of discovery.systems) {
      console.log(`     ${sys.icon} ${sys.name} → ${sys.path}`);
    }
    console.log();

    const server = await createServer(discovery, { port, verbose: opts.verbose });

    await server.listen({ port, host: '0.0.0.0' });

    const url = `http://localhost:${port}`;
    console.log(`   🚀 Dashboard: ${url}\n`);

    if (opts.open) {
      await open(url);
    }

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n   Shutting down...');
      await server.close();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (err) => {
      console.error('   ⚠️  Uncaught exception:', err.message);
    });
    process.on('unhandledRejection', (err) => {
      console.error('   ⚠️  Unhandled rejection:', err);
    });
  });

program.parse();
