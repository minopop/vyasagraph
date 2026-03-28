/**
 * Relation CRUD operations for VyasaGraph v2.
 * Uses SurrealDB graph edges (RELATE) for native graph traversal.
 * @module relations
 */

import { getDb } from './db.js';

/**
 * Creates one or more relations (graph edges) between entities.
 * @param {Array<{from: string, to: string, relationType?: string}>} relations
 * @returns {Promise<{created: number, errors: string[]}>}
 */
export async function createRelations(relations) {
  const db = getDb();
  let created = 0;
  const errors = [];

  for (const rel of relations) {
    if (!rel.from || !rel.to) {
      errors.push(`Invalid relation: missing from or to`);
      continue;
    }

    try {
      // Look up entity record IDs by name
      const [fromResult] = await db.query(
        'SELECT id FROM entity WHERE name = $name',
        { name: rel.from }
      );
      const [toResult] = await db.query(
        'SELECT id FROM entity WHERE name = $name',
        { name: rel.to }
      );

      if (!fromResult || fromResult.length === 0) {
        errors.push(`Source entity "${rel.from}" not found`);
        continue;
      }
      if (!toResult || toResult.length === 0) {
        errors.push(`Target entity "${rel.to}" not found`);
        continue;
      }

      const fromId = fromResult[0].id;
      const toId = toResult[0].id;

      await db.query(
        `RELATE $fromId->relates_to->$toId SET
          relationType = $relationType,
          createdAt = time::now()`,
        {
          fromId,
          toId,
          relationType: rel.relationType || 'related_to'
        }
      );
      created++;
    } catch (e) {
      errors.push(`Relation "${rel.from}" -> "${rel.to}": ${e.message}`);
    }
  }

  return { created, errors };
}

/**
 * Deletes specific relations.
 * @param {Array<{from: string, to: string, relationType?: string}>} relations
 * @returns {Promise<{deleted: number, errors: string[]}>}
 */
export async function deleteRelations(relations) {
  const db = getDb();
  let deleted = 0;
  const errors = [];

  for (const rel of relations) {
    try {
      let query, params;

      if (rel.relationType) {
        query = `DELETE relates_to WHERE in.name = $from AND out.name = $to AND relationType = $relationType`;
        params = { from: rel.from, to: rel.to, relationType: rel.relationType };
      } else {
        query = `DELETE relates_to WHERE in.name = $from AND out.name = $to`;
        params = { from: rel.from, to: rel.to };
      }

      await db.query(query, params);
      deleted++;
    } catch (e) {
      errors.push(`Relation "${rel.from}" -> "${rel.to}": ${e.message}`);
    }
  }

  return { deleted, errors };
}

/**
 * Gets all relations for an entity (both incoming and outgoing).
 * @param {string} entityName
 * @returns {Promise<Object[]>} Array of relation objects with from, to, relationType.
 */
export async function getRelations(entityName) {
  const db = getDb();

  const [result] = await db.query(
    `SELECT
      in.name AS from,
      out.name AS to,
      relationType,
      createdAt
    FROM relates_to
    WHERE in.name = $name OR out.name = $name`,
    { name: entityName }
  );

  return result || [];
}

/**
 * Gets all relations in the database.
 * @returns {Promise<Object[]>}
 */
export async function getAllRelations() {
  const db = getDb();
  const [result] = await db.query(
    `SELECT
      in.name AS from,
      out.name AS to,
      relationType,
      createdAt
    FROM relates_to`
  );
  return result || [];
}

/**
 * Gets relation count.
 * @returns {Promise<number>}
 */
export async function getRelationCount() {
  const db = getDb();
  const [result] = await db.query('SELECT count() AS total FROM relates_to GROUP ALL');
  return (result && result.length > 0) ? result[0].total : 0;
}
