/**
 * SurrealDB connection and schema initialization for VyasaGraph v2.
 * @module db
 */

import { Surreal } from 'surrealdb';
import { createNodeEngines } from '@surrealdb/node';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {Surreal} */
let db = null;

/** @type {boolean} */
let initialized = false;

/**
 * Initializes the SurrealDB embedded database.
 * @param {string} [dbPath] - Path to the database directory. Defaults to ./vyasagraph.db in the vyasagraph directory.
 * @param {Object} [options] - Options.
 * @param {boolean} [options.memory=false] - Use in-memory storage instead of disk.
 * @returns {Promise<Surreal>} The database instance.
 */
export async function init(dbPath, options = {}) {
  if (initialized && db) return db;

  db = new Surreal({
    engines: createNodeEngines()
  });

  let connectionString;
  if (options.memory) {
    connectionString = 'mem://';
  } else {
    // Resolve to absolute path
    const resolvedPath = dbPath ? resolve(process.cwd(), dbPath) : resolve(__dirname, '..', 'vyasagraph.db');
    
    // RocksDB requires a simple filename and expects to be run from the target directory
    // Extract the directory and filename
    const pathParts = resolvedPath.split(/[/\\]/);
    const dbName = pathParts.pop() || 'vyasagraph.db';
    const dbDir = pathParts.join('/') || process.cwd();
    
    // Change to the database directory
    const originalCwd = process.cwd();
    process.chdir(dbDir);
    
    connectionString = `rocksdb://${dbName}`;
  }

  await db.connect(connectionString);
  await db.use({ namespace: 'vyasa', database: 'memory' });
  await initSchema();

  initialized = true;
  return db;
}

/**
 * Returns the active database instance.
 * @returns {Surreal}
 * @throws {Error} If database is not initialized.
 */
export function getDb() {
  if (!db || !initialized) {
    throw new Error('VyasaGraph not initialized. Call init() first.');
  }
  return db;
}

/**
 * Initializes the database schema.
 * @returns {Promise<void>}
 */
async function initSchema() {
  // Entity table (v3: SCHEMALESS to allow flexible metadata fields)
  await db.query(`
    DEFINE TABLE IF NOT EXISTS entity SCHEMALESS;
    DEFINE FIELD IF NOT EXISTS name ON entity TYPE string;
    DEFINE FIELD IF NOT EXISTS entityType ON entity TYPE string DEFAULT 'unknown';
    DEFINE FIELD IF NOT EXISTS observations ON entity TYPE array DEFAULT [];
    DEFINE FIELD IF NOT EXISTS currentState ON entity TYPE option<string>;
    DEFINE FIELD IF NOT EXISTS embedding ON entity TYPE option<array<float>>;
    DEFINE FIELD IF NOT EXISTS createdAt ON entity TYPE datetime DEFAULT time::now();
    DEFINE FIELD IF NOT EXISTS updatedAt ON entity TYPE datetime DEFAULT time::now();
    DEFINE INDEX IF NOT EXISTS entity_name ON entity FIELDS name UNIQUE;
  `);

  // Vector index (separate query to handle gracefully if unsupported)
  try {
    await db.query(`
      DEFINE INDEX IF NOT EXISTS entity_vector ON entity FIELDS embedding HNSW DIMENSION 1536 DIST COSINE;
    `);
  } catch (e) {
    console.warn('[vyasagraph] HNSW vector index not available:', e.message);
  }

  // Relation edge table for graph traversal
  await db.query(`
    DEFINE TABLE IF NOT EXISTS relates_to SCHEMAFULL TYPE RELATION;
    DEFINE FIELD IF NOT EXISTS relationType ON relates_to TYPE string DEFAULT 'related_to';
    DEFINE FIELD IF NOT EXISTS createdAt ON relates_to TYPE datetime DEFAULT time::now();
  `);
}

/**
 * Closes the database connection.
 * @returns {Promise<void>}
 */
export async function close() {
  if (db) {
    await db.close();
    db = null;
    initialized = false;
  }
}

export default { init, getDb, close };
