/**
 * VyasaGraph v2 - Embedded knowledge graph database using SurrealDB.
 *
 * Production replacement for MCP memory server.
 * Provides entity CRUD, graph relations, and vector search.
 *
 * @module vyasagraph
 */

export { init, getDb, close } from './db.js';
export {
  createEntities,
  addObservations,
  deleteEntities,
  getEntity,
  updateEntity,
  getAllEntities,
  getEntityCount
} from './entities.js';
export {
  createRelations,
  deleteRelations,
  getRelations,
  getAllRelations,
  getRelationCount
} from './relations.js';
export {
  searchNodes,
  searchText,
  openNodes,
  readGraph
} from './search.js';
export { smartSearch } from './smart-search.js';
export {
  generateEmbedding,
  generateEmbeddings
} from './embeddings.js';
export {
  regenerateEmbedding,
  regenerateAllEmbeddings,
  addObservationsWithRegeneration
} from './regenerate.js';
export {
  createVerror,
  resolveVerror,
  searchVerrors,
  getUnresolvedVerrors,
  getTodayVerrors,
  logRecurrence,
  detectAndLogError
} from './verrors.js';
export {
  searchByType,
  searchProjects,
  searchTasks,
  searchMilestones,
  searchAgents,
  getProject,
  getProjectMilestones,
  getMilestoneTasks,
  getTasksBlockedBy,
  formatAsVtasks,
  formatProjectRoadmap
} from './project-queries.js';

/**
 * Returns database statistics.
 * @returns {Promise<{entityCount: number, relationCount: number}>}
 */
export async function getStats() {
  const { getEntityCount } = await import('./entities.js');
  const { getRelationCount } = await import('./relations.js');

  return {
    entityCount: await getEntityCount(),
    relationCount: await getRelationCount()
  };
}
