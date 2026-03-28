/**
 * Embedding regeneration utilities for VyasaGraph
 * @module regenerate
 */

import { getDb } from './db.js';
import { generateEmbedding } from './embeddings.js';

/**
 * Regenerate embedding for a single entity based on current observations
 * @param {string} entityName - Name of entity to regenerate
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function regenerateEmbedding(entityName) {
  const db = getDb();

  try {
    // Get current entity
    const [entities] = await db.query(
      `SELECT * FROM entity WHERE name = $name`,
      { name: entityName }
    );

    if (!entities || entities.length === 0) {
      return { success: false, error: 'Entity not found' };
    }

    const entity = entities[0];

    // Generate new embedding from entity name + all observations
    // Name is prepended to ensure vector search matches name queries
    const text = `${entity.name}\n${entity.observations.join(' ')}`;
    const embedding = await generateEmbedding(text);

    if (!embedding) {
      return { success: false, error: 'Embedding generation failed (no API key?)' };
    }

    // Update entity with new embedding
    await db.query(
      `UPDATE entity SET embedding = $embedding, updatedAt = time::now() WHERE name = $name`,
      { name: entityName, embedding }
    );

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Regenerate embeddings for all entities (or filtered by type)
 * @param {Object} options - Options
 * @param {string} [options.entityType] - Filter by entity type
 * @param {boolean} [options.skipExisting=false] - Skip entities that already have embeddings
 * @param {Function} [options.onProgress] - Progress callback (entity, index, total)
 * @returns {Promise<{regenerated: number, skipped: number, failed: Array<{entity: string, error: string}>}>}
 */
export async function regenerateAllEmbeddings(options = {}) {
  const db = getDb();
  const { entityType, skipExisting = false, onProgress } = options;

  let query = 'SELECT * FROM entity';
  const params = {};

  if (entityType) {
    query += ' WHERE entityType = $entityType';
    params.entityType = entityType;
  }

  if (skipExisting) {
    query += entityType ? ' AND embedding IS NONE' : ' WHERE embedding IS NONE';
  }

  const [entities] = await db.query(query, params);

  if (!entities || entities.length === 0) {
    return { regenerated: 0, skipped: 0, failed: [] };
  }

  let regenerated = 0;
  let skipped = 0;
  const failed = [];

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];

    if (onProgress) {
      onProgress(entity.name, i + 1, entities.length);
    }

    // Skip if no observations
    if (!entity.observations || entity.observations.length === 0) {
      skipped++;
      continue;
    }

    const result = await regenerateEmbedding(entity.name);

    if (result.success) {
      regenerated++;
    } else {
      failed.push({ entity: entity.name, error: result.error });
      skipped++;
    }
  }

  return { regenerated, skipped, failed };
}

/**
 * Add observations AND regenerate embedding in one operation
 * @param {Array<{entityName: string, contents: string[]}>} observations
 * @returns {Promise<{updated: number, errors: string[]}>}
 */
export async function addObservationsWithRegeneration(observations) {
  const db = getDb();
  let updated = 0;
  const errors = [];

  for (const obs of observations) {
    if (!obs.entityName || !Array.isArray(obs.contents)) {
      errors.push(`Invalid observation: missing entityName or contents`);
      continue;
    }

    try {
      // Add observations
      const [result] = await db.query(
        `UPDATE entity SET
          observations = array::union(observations, $newObs),
          updatedAt = time::now()
        WHERE name = $name`,
        { name: obs.entityName, newObs: obs.contents }
      );

      if (!result || result.length === 0) {
        errors.push(`Entity "${obs.entityName}" not found`);
        continue;
      }

      // Regenerate embedding
      const regenResult = await regenerateEmbedding(obs.entityName);
      if (!regenResult.success) {
        errors.push(`Entity "${obs.entityName}": embedding regeneration failed - ${regenResult.error}`);
      }

      updated++;
    } catch (e) {
      errors.push(`Entity "${obs.entityName}": ${e.message}`);
    }
  }

  return { updated, errors };
}
