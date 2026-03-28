/**
 * Entity CRUD operations for VyasaGraph v2.
 * @module entities
 */

import { getDb } from './db.js';
import { generateEmbedding } from './embeddings.js';
import { regenerateEmbedding } from './regenerate.js';

/**
 * Creates one or more entities.
 * @param {Array<{name: string, entityType?: string, observations?: string[], metadata?: Object, embedding?: number[]}>} entities
 * @returns {Promise<{created: number, errors: string[]}>}
 */
export async function createEntities(entities) {
  const db = getDb();
  let created = 0;
  const errors = [];

  for (const ent of entities) {
    if (!ent.name || typeof ent.name !== 'string') {
      errors.push(`Invalid entity: missing or invalid name`);
      continue;
    }

    try {
      const params = {
        name: ent.name,
        entityType: ent.entityType || 'unknown',
        observations: ent.observations || []
      };

      // Generate embedding if not provided
      // Include entity name in embedding so vector search matches name queries
      let embedding = ent.embedding;
      if (!embedding && params.observations.length > 0) {
        const textToEmbed = `${ent.name}\n${params.observations.join(' ')}`;
        embedding = await generateEmbedding(textToEmbed);
      }

      let query = `CREATE entity SET
          name = $name,
          entityType = $entityType,
          observations = $observations,
          createdAt = time::now(),
          updatedAt = time::now()`;

      if (embedding && Array.isArray(embedding)) {
        query += `, embedding = $embedding`;
        params.embedding = embedding;
      }

      // v3: Add optional metadata field
      if (ent.metadata && typeof ent.metadata === 'object') {
        query += `, metadata = $metadata`;
        params.metadata = ent.metadata;
      }

      await db.query(query, params);
      created++;
    } catch (e) {
      errors.push(`Entity "${ent.name}": ${e.message}`);
    }
  }

  return { created, errors };
}

/**
 * Adds observations to existing entities and automatically regenerates embeddings.
 * @param {Array<{entityName: string, contents: string[]}>} observations
 * @returns {Promise<{updated: number, errors: string[]}>}
 */
export async function addObservations(observations) {
  const db = getDb();
  let updated = 0;
  const errors = [];

  for (const obs of observations) {
    if (!obs.entityName || !Array.isArray(obs.contents)) {
      errors.push(`Invalid observation: missing entityName or contents`);
      continue;
    }

    try {
      const [result] = await db.query(
        `UPDATE entity SET
          observations = array::union(observations, $newObs),
          updatedAt = time::now()
        WHERE name = $name`,
        { name: obs.entityName, newObs: obs.contents }
      );

      if (result && result.length > 0) {
        updated++;
        // Always regenerate embedding so new observations are immediately searchable
        await regenerateEmbedding(obs.entityName);
      } else {
        errors.push(`Entity "${obs.entityName}" not found`);
      }
    } catch (e) {
      errors.push(`Entity "${obs.entityName}": ${e.message}`);
    }
  }

  return { updated, errors };
}

/**
 * Deletes entities by name.
 * @param {string[]} entityNames
 * @returns {Promise<{deleted: number, errors: string[]}>}
 */
export async function deleteEntities(entityNames) {
  const db = getDb();
  let deleted = 0;
  const errors = [];

  for (const name of entityNames) {
    try {
      // Delete related edges first
      await db.query(
        `DELETE relates_to WHERE in.name = $name OR out.name = $name`,
        { name }
      );

      const [result] = await db.query(
        `DELETE entity WHERE name = $name RETURN BEFORE`,
        { name }
      );

      if (result && result.length > 0) {
        deleted++;
      } else {
        errors.push(`Entity "${name}" not found`);
      }
    } catch (e) {
      errors.push(`Entity "${name}": ${e.message}`);
    }
  }

  return { deleted, errors };
}

/**
 * Gets an entity by name.
 * @param {string} name
 * @returns {Promise<Object|null>}
 */
export async function getEntity(name) {
  const db = getDb();
  const [result] = await db.query(
    `SELECT * FROM entity WHERE name = $name`,
    { name }
  );
  return (result && result.length > 0) ? result[0] : null;
}

/**
 * Updates an entity by name.
 * @param {string} name
 * @param {Object} updates - Fields to update (entityType, observations, embedding).
 * @returns {Promise<Object|null>} The updated entity, or null if not found.
 */
export async function updateEntity(name, updates) {
  const db = getDb();

  const setClauses = ['updatedAt = time::now()'];
  const params = { name };

  if (updates.entityType !== undefined) {
    setClauses.push('entityType = $entityType');
    params.entityType = updates.entityType;
  }
  if (updates.observations !== undefined) {
    setClauses.push('observations = $observations');
    params.observations = updates.observations;
  }
  if (updates.embedding !== undefined) {
    setClauses.push('embedding = $embedding');
    params.embedding = updates.embedding;
  }
  if (updates.metadata !== undefined && typeof updates.metadata === 'object') {
    setClauses.push('metadata = $metadata');
    params.metadata = updates.metadata;
  }
  if (updates.name !== undefined) {
    setClauses.push('name = $newName');
    params.newName = updates.name;
  }

  const [result] = await db.query(
    `UPDATE entity SET ${setClauses.join(', ')} WHERE name = $name`,
    params
  );

  // Regenerate embedding if observations or metadata changed (affects searchability)
  if (result && result.length > 0 &&
      (updates.observations !== undefined || updates.metadata !== undefined)) {
    await regenerateEmbedding(name);
  }

  return (result && result.length > 0) ? result[0] : null;
}

/**
 * Gets all entities.
 * @returns {Promise<Object[]>}
 */
export async function getAllEntities() {
  const db = getDb();
  const [result] = await db.query('SELECT * FROM entity ORDER BY name');
  return result || [];
}

/**
 * Gets entity count.
 * @returns {Promise<number>}
 */
export async function getEntityCount() {
  const db = getDb();
  const [result] = await db.query('SELECT count() AS total FROM entity GROUP ALL');
  return (result && result.length > 0) ? result[0].total : 0;
}
