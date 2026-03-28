/**
 * VyasaGraph v4 - Error Tracking (verrors)
 * 
 * Unified error tracking within VyasaGraph using Error entities.
 * Replaces the never-built error-tracker.js system.
 * 
 * @module verrors
 */

import { createEntities, addObservations, updateEntity, getEntity } from './entities.js';
import { smartSearch } from './smart-search.js';

/**
 * Meta-learning: Why verrors exists
 * 
 * The classic failure mode: an error-tracker.js + errors.db was documented
 * and promised but never built. The database stayed empty (0 bytes). Errors 
 * were inconsistently logged to a VyasaGraph entity instead.
 * 
 * ROOT CAUSE: No enforcement mechanism. If policy is not programmatically 
 * enforced, voluntary compliance fails under cognitive load. Documentation 
 * alone is insufficient.
 * 
 * v4 Solution: Merge error tracking into VyasaGraph with passive enforcement
 * (automatic error detection from tool results) and future hook-based enforcement.
 */

/**
 * Calculate error severity based on error details
 * @param {Object} error - Error details
 * @returns {string} 'critical' | 'high' | 'medium' | 'low'
 */
function calculateSeverity(error) {
  // Critical: Blocks user workflow
  if (error.type === 'init_failure' || error.subsystem === 'vyasagraph') {
    return 'critical';
  }
  
  // High: Important feature fails
  if (error.type === 'cron_failure' || error.type === 'tool_failure') {
    return 'high';
  }
  
  // Medium: Degraded functionality
  if (error.type === 'timeout' || error.type === 'retry_succeeded') {
    return 'medium';
  }
  
  // Low: Minor issues
  return 'low';
}

/**
 * Generate error entity name following naming convention
 * @param {string} subsystem - System that failed
 * @param {string} errorType - Type of error
 * @returns {string} Entity name like "ERR-001 (VyasaGraph timeout, 2026-03-24)"
 */
function generateErrorName(subsystem, errorType) {
  const timestamp = new Date().toISOString().split('T')[0];
  const errorId = `ERR-${Date.now().toString().slice(-6)}`;
  return `${errorId} (${subsystem} ${errorType}, ${timestamp})`;
}

/**
 * Create a verror (Error entity in VyasaGraph)
 * @param {Object} params - Error parameters
 * @param {string} params.subsystem - System that failed (e.g., 'vyasagraph', 'cron_daily_summary')
 * @param {string} params.errorType - Error type (e.g., 'timeout', 'init_failure', 'tool_failure')
 * @param {string} params.errorMessage - Human-readable error description
 * @param {string} [params.severity] - Override severity calculation ('critical'|'high'|'medium'|'low')
 * @param {string} [params.impact] - User-facing impact description
 * @param {string} [params.context] - Additional context
 * @param {string} [params.recurrenceOf] - Entity name of original error if this is a recurrence
 * @returns {Promise<{created: boolean, entityName: string, error?: string}>}
 */
export async function createVerror({
  subsystem,
  errorType,
  errorMessage,
  severity = null,
  impact = null,
  context = null,
  recurrenceOf = null
}) {
  try {
    const entityName = generateErrorName(subsystem, errorType);
    
    // Calculate severity if not provided
    const calculatedSeverity = severity || calculateSeverity({ 
      type: errorType, 
      subsystem 
    });
    
    // Build observations
    const observations = [
      `${subsystem} error: ${errorMessage}`,
      `Error type: ${errorType}`,
      `Severity: ${calculatedSeverity}`
    ];
    
    if (context) {
      observations.push(`Context: ${context}`);
    }
    
    if (impact) {
      observations.push(`Impact: ${impact}`);
    }
    
    if (recurrenceOf) {
      observations.push(`Recurrence of: ${recurrenceOf}`);
    }
    
    // Create Error entity
    const result = await createEntities([{
      name: entityName,
      entityType: 'Error',
      metadata: {
        subsystem,
        errorType,
        severity: calculatedSeverity,
        status: 'unresolved',
        timestamp: new Date().toISOString(),
        impact: impact || `${subsystem} failed`,
        recurrenceOf: recurrenceOf || null
      },
      observations
    }]);
    
    if (result.errors.length > 0) {
      return { 
        created: false, 
        entityName, 
        error: result.errors[0] 
      };
    }
    
    return { 
      created: true, 
      entityName 
    };
  } catch (err) {
    return { 
      created: false, 
      entityName: null, 
      error: err.message 
    };
  }
}

/**
 * Resolve a verror (mark as resolved)
 * @param {string} errorEntityName - Name of the Error entity
 * @param {string} resolution - How the error was resolved
 * @returns {Promise<{resolved: boolean, error?: string}>}
 */
export async function resolveVerror(errorEntityName, resolution) {
  try {
    // Update metadata status
    await updateEntity(errorEntityName, {
      metadata: {
        status: 'resolved',
        resolvedAt: new Date().toISOString()
      }
    });
    
    // Add resolution observation
    await addObservations([{
      entityName: errorEntityName,
      contents: [`Resolution: ${resolution}`]
    }]);
    
    return { resolved: true };
  } catch (err) {
    return { 
      resolved: false, 
      error: err.message 
    };
  }
}

/**
 * Search verrors (Error entities)
 * @param {Object} filters - Search filters
 * @param {string} [filters.query] - Semantic search query
 * @param {string} [filters.status] - Filter by status ('unresolved'|'resolved')
 * @param {string} [filters.severity] - Filter by severity
 * @param {string} [filters.subsystem] - Filter by subsystem
 * @param {number} [filters.limit=20] - Max results
 * @returns {Promise<Array>} Array of Error entities
 */
export async function searchVerrors({
  query = null,
  status = null,
  severity = null,
  subsystem = null,
  limit = 20
} = {}) {
  try {
    // Start with semantic search if query provided
    let results = query 
      ? await smartSearch(query, limit * 2)  // Over-fetch for filtering
      : await smartSearch('error', limit * 2);
    
    // Filter to Error entities only
    results = results.filter(e => e.entityType === 'Error');
    
    // Apply metadata filters
    if (status) {
      results = results.filter(e => e.metadata?.status === status);
    }
    
    if (severity) {
      results = results.filter(e => e.metadata?.severity === severity);
    }
    
    if (subsystem) {
      results = results.filter(e => e.metadata?.subsystem === subsystem);
    }
    
    // Limit results
    return results.slice(0, limit);
  } catch (err) {
    console.error('Verror search failed:', err.message);
    return [];
  }
}

/**
 * Get unresolved verrors (for daily/weekly summaries)
 * @param {number} [limit=10] - Max results
 * @returns {Promise<Array>} Array of unresolved Error entities
 */
export async function getUnresolvedVerrors(limit = 10) {
  return searchVerrors({ status: 'unresolved', limit });
}

/**
 * Get verrors from today
 * @returns {Promise<Array>} Array of Error entities created today
 */
export async function getTodayVerrors() {
  const today = new Date().toISOString().split('T')[0];
  const results = await searchVerrors({ limit: 50 });
  
  return results.filter(e => 
    e.metadata?.timestamp?.startsWith(today)
  );
}

/**
 * Log recurrence of an existing error
 * @param {string} originalErrorName - Name of the original Error entity
 * @param {string} newContext - New context for this recurrence
 * @returns {Promise<{created: boolean, entityName: string, error?: string}>}
 */
export async function logRecurrence(originalErrorName, newContext) {
  try {
    // Get original error to extract details
    const original = await getEntity(originalErrorName);
    
    if (!original) {
      return { 
        created: false, 
        entityName: null, 
        error: 'Original error not found' 
      };
    }
    
    // Create new error with recurrence link
    return createVerror({
      subsystem: original.metadata.subsystem,
      errorType: original.metadata.errorType,
      errorMessage: `Recurrence: ${original.metadata.errorType}`,
      context: newContext,
      recurrenceOf: originalErrorName
    });
  } catch (err) {
    return { 
      created: false, 
      entityName: null, 
      error: err.message 
    };
  }
}

/**
 * Passive error detection from tool results (automatic)
 * Call this after any tool execution to auto-create verrors
 * 
 * @param {Object} toolResult - Result from tool execution
 * @param {string} toolName - Name of the tool that was called
 * @param {string} [userContext] - Current user task (from SESSION-STATE)
 * @returns {Promise<{detected: boolean, verrorCreated: boolean, entityName?: string}>}
 */
export async function detectAndLogError(toolResult, toolName, userContext = null) {
  try {
    // Check for error indicators
    const hasError = toolResult.error || 
                     toolResult.status === 'error' ||
                     (toolResult.code && toolResult.code !== 0);
    
    if (!hasError) {
      return { detected: false, verrorCreated: false };
    }
    
    // Detect error type
    let errorType = 'tool_failure';
    if (toolResult.timeout || /timeout/i.test(toolResult.error)) {
      errorType = 'timeout';
    }
    
    // Create verror
    const result = await createVerror({
      subsystem: toolName,
      errorType,
      errorMessage: toolResult.error || toolResult.message || 'Unknown error',
      context: userContext,
      impact: `${toolName} operation failed`
    });
    
    return {
      detected: true,
      verrorCreated: result.created,
      entityName: result.entityName,
      error: result.error
    };
  } catch (err) {
    console.error('Error detection failed:', err.message);
    return { 
      detected: true, 
      verrorCreated: false, 
      error: err.message 
    };
  }
}
