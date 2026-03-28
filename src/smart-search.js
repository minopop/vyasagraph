/**
 * Smart search wrapper for VyasaGraph - ALWAYS uses vector embeddings.
 * Handles text queries by generating embeddings automatically.
 * Applies name-boosting with entity type awareness and alias differentiation.
 * @module smart-search
 */

import { generateEmbedding } from './embeddings.js';
import { searchNodes } from './search.js';

/**
 * Smart semantic search with type-aware name boosting.
 * This is the PRIMARY search interface for VyasaGraph.
 * 
 * Naming convention: [Primary Name] ([aliases, relationships, context])
 * - Primary name matches: +0.35 boost
 * - Alias matches (in parentheses): +0.20 boost
 * - Person entity + person-like query: +0.10 additional boost
 * 
 * @param {string} query - Natural language search query
 * @param {number} [limit=10] - Maximum results to return
 * @param {Object} [options] - Search options
 * @param {boolean} [options.disableNameBoosting=false] - Disable name-match boosting
 * @returns {Promise<Object[]>} Entities sorted by similarity (with boosting applied)
 */
export async function smartSearch(query, limit = 10, options = {}) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string');
  }

  const { disableNameBoosting = false } = options;

  // Generate embedding for the query
  const embedding = await generateEmbedding(query);
  
  // Use vector similarity search (get more results for boosting)
  // Fetch 10x limit to ensure entities that rank low semantically but high by name get included
  const rawResults = await searchNodes(embedding, Math.max(50, limit * 10));

  // Apply name boosting if enabled
  if (!disableNameBoosting) {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length >= 2);

    // Detect if query looks like a person name (short, capitalized terms)
    const looksLikePersonName = queryTerms.length <= 3 && 
      queryTerms.every(t => t.length < 15) &&
      !queryTerms.some(t => ['project', 'document', 'strategy', 'initiative'].includes(t));

    for (const result of rawResults) {
      const nameLower = result.name.toLowerCase();
      
      // Extract primary name (before parentheses) and aliases (in parentheses)
      const primaryNameMatch = result.name.match(/^([^(]+)/);
      const primaryName = primaryNameMatch ? primaryNameMatch[1].trim().toLowerCase() : nameLower;
      const aliasesMatch = result.name.match(/\(([^)]+)\)/);
      const aliases = aliasesMatch ? aliasesMatch[1].toLowerCase() : '';
      
      // Check matches in primary name vs aliases
      const primaryMatches = queryTerms.filter(term => primaryName.includes(term)).length;
      const aliasMatches = queryTerms.filter(term => aliases.includes(term)).length;
      
      let boost = 0;
      
      // Primary name matches get highest boost
      if (primaryMatches > 0) {
        boost += 0.35 * (primaryMatches / queryTerms.length);
      }
      
      // Alias matches get moderate boost
      if (aliasMatches > 0) {
        boost += 0.20 * (aliasMatches / queryTerms.length);
      }
      
      // Person entity gets additional boost if query looks like a person name
      if (looksLikePersonName && result.entityType?.toLowerCase().includes('person')) {
        boost += 0.10;
      }
      
      if (boost > 0) {
        result.score = Math.min(1.0, result.score + boost);
        result._nameBoosted = true;
        result._boostAmount = boost;
      }
    }

    // Re-sort after boosting
    rawResults.sort((a, b) => b.score - a.score);
  }

  // Return top N after boosting
  return rawResults.slice(0, limit);
}
