#!/usr/bin/env node
/**
 * VyasaGraph CLI - Simple command-line interface
 * Usage: node cli.js <command> [args]
 */

import * as vg from './index.js';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', 'vyasagraph.db');

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command) {
    console.log('Usage: node cli.js <command> [args]');
    console.log('Commands:');
    console.log('  search <query>      - Search for entities');
    console.log('  get <name>          - Get specific entity');
    console.log('  stats               - Show database stats');
    process.exit(1);
  }

  try {
    await vg.init(dbPath);

    switch (command) {
      case 'search': {
        const query = args.join(' ');
        const results = await vg.smartSearch(query, 10);
        console.log(JSON.stringify(results, null, 2));
        break;
      }

      case 'get': {
        const name = args.join(' ');
        const entity = await vg.getEntity(name);
        console.log(JSON.stringify(entity, null, 2));
        break;
      }

      case 'stats': {
        const stats = await vg.getStats();
        console.log(JSON.stringify(stats, null, 2));
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    await vg.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
