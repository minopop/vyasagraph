/**
 * Search operations for VyasaGraph v2.
 * Supports vector similarity search and text search.
 * @module search
 */

import { getDb } from './db.js';

/**
 * Semantic search using vector similarity (cosine distance).
 * Requires entities to have embeddings stored.
 * @param {number[]} queryEmbedding - 1536-dimensional embedding vector.
 * @param {number} [limit=10] - Maximum results to return.
 * @returns {Promise<Object[]>} Entities sorted by similarity (closest first).
 */
export async function searchNodes(queryEmbedding, limit = 10) {
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== 1536) {
    throw new Error(`Expected 1536-dim embedding, got ${Array.isArray(queryEmbedding) ? queryEmbedding.length : 'non-array'}`);
  }

  const db = getDb();

  const [result] = await db.query(
    `SELECT *,
      vector::similarity::cosine(embedding, $embedding) AS score
    FROM entity
    WHERE embedding IS NOT NONE
    ORDER BY score DESC
    LIMIT $limit`,
    { embedding: queryEmbedding, limit }
  );

  return result || [];
}

/**
 * Text search across entity names and observations.
 * @param {string} query - Search query string.
 * @param {number} [limit=10] - Maximum results to return.
 * @returns {Promise<Object[]>} Matching entities.
 */
export async function searchText(query, limit = 10) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  const db = getDb();
  const lowerQuery = query.toLowerCase();

  const [result] = await db.query(
    `SELECT * FROM entity
    WHERE string::lowercase(name) CONTAINS $query
      OR string::lowercase(string::join(observations, ' ')) CONTAINS $query
    LIMIT $limit`,
    { query: lowerQuery, limit }
  );

  return result || [];
}

/**
 * Opens specific nodes by name, including their relations.
 * @param {string[]} names - Entity names to retrieve.
 * @returns {Promise<{entities: Object[], relations: Object[]}>}
 */
export async function openNodes(names) {
  if (!Array.isArray(names) || names.length === 0) {
    return { entities: [], relations: [] };
  }

  const db = getDb();

  const [entities] = await db.query(
    `SELECT * FROM entity WHERE name IN $names`,
    { names }
  );

  const [relations] = await db.query(
    `SELECT
      in.name AS from,
      out.name AS to,
      relationType
    FROM relates_to
    WHERE in.name IN $names OR out.name IN $names`,
    { names }
  );

  return {
    entities: entities || [],
    relations: relations || []
  };
}

/**
 * Reads the full graph (all entities and relations).
 * @returns {Promise<{entities: Object[], relations: Object[]}>}
 */
export async function readGraph() {
  const db = getDb();

  const [entities] = await db.query('SELECT * FROM entity ORDER BY name');
  const [relations] = await db.query(
    `SELECT
      in.name AS from,
      out.name AS to,
      relationType
    FROM relates_to`
  );

  return {
    entities: entities || [],
    relations: relations || []
  };
}
