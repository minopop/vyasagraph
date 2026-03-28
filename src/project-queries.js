/**
 * VyasaGraph v3 - Project management query helpers.
 * @module project-queries
 */

import { getDb } from './db.js';
import { searchText } from './search.js';
import { smartSearch } from './smart-search.js';

/**
 * Search entities by type with optional metadata filters.
 * @param {string} entityType - Entity type to search for
 * @param {Object} filters - Optional metadata filters
 * @returns {Promise<Object[]>}
 */
export async function searchByType(entityType, filters = {}) {
  const db = getDb();
  
  let query = 'SELECT * FROM entity WHERE entityType = $entityType';
  const params = { entityType };
  
  // Add metadata filters if provided
  if (filters.status) {
    query += ' AND metadata.status = $status';
    params.status = filters.status;
  }
  if (filters.priority) {
    query += ' AND metadata.priority = $priority';
    params.priority = filters.priority;
  }
  if (filters.category) {
    query += ' AND metadata.category = $category';
    params.category = filters.category;
  }
  if (filters.assignee) {
    query += ' AND metadata.assignee = $assignee';
    params.assignee = filters.assignee;
  }
  
  query += ' ORDER BY name';
  
  const [result] = await db.query(query, params);
  return result || [];
}

/**
 * Search projects with optional filters.
 * @param {Object} filters - Optional filters (status, category, priority)
 * @returns {Promise<Object[]>}
 */
export async function searchProjects(filters = {}) {
  return searchByType('Project', filters);
}

/**
 * Search tasks with optional filters.
 * @param {Object} filters - Optional filters (status, assignee, project, milestone)
 * @returns {Promise<Object[]>}
 */
export async function searchTasks(filters = {}) {
  const db = getDb();
  
  let query = 'SELECT * FROM entity WHERE entityType = $entityType';
  const params = { entityType: 'Task' };
  
  if (filters.status) {
    query += ' AND metadata.status = $status';
    params.status = filters.status;
  }
  if (filters.assignee) {
    query += ' AND metadata.assignee = $assignee';
    params.assignee = filters.assignee;
  }
  if (filters.project) {
    query += ' AND metadata.project = $project';
    params.project = filters.project;
  }
  if (filters.milestone) {
    query += ' AND metadata.milestone = $milestone';
    params.milestone = filters.milestone;
  }
  
  query += ' ORDER BY name';
  
  const [result] = await db.query(query, params);
  return result || [];
}

/**
 * Search milestones with optional filters.
 * @param {Object} filters - Optional filters (project, status)
 * @returns {Promise<Object[]>}
 */
export async function searchMilestones(filters = {}) {
  const db = getDb();
  
  let query = 'SELECT * FROM entity WHERE entityType = $entityType';
  const params = { entityType: 'Milestone' };
  
  if (filters.project) {
    query += ' AND metadata.project = $project';
    params.project = filters.project;
  }
  if (filters.status) {
    query += ' AND metadata.status = $status';
    params.status = filters.status;
  }
  
  query += ' ORDER BY name';
  
  const [result] = await db.query(query, params);
  return result || [];
}

/**
 * Search agents with optional filters.
 * @param {Object} filters - Optional filters (status, agentType, task)
 * @returns {Promise<Object[]>}
 */
export async function searchAgents(filters = {}) {
  const db = getDb();
  
  let query = 'SELECT * FROM entity WHERE entityType = $entityType';
  const params = { entityType: 'Agent' };
  
  if (filters.status) {
    query += ' AND metadata.status = $status';
    params.status = filters.status;
  }
  if (filters.agentType) {
    query += ' AND metadata.agentType = $agentType';
    params.agentType = filters.agentType;
  }
  if (filters.task) {
    query += ' AND metadata.task = $task';
    params.task = filters.task;
  }
  
  query += ' ORDER BY name';
  
  const [result] = await db.query(query, params);
  return result || [];
}

/**
 * Get a project by name.
 * @param {string} name - Project name
 * @returns {Promise<Object|null>}
 */
export async function getProject(name) {
  const db = getDb();
  const [result] = await db.query(
    'SELECT * FROM entity WHERE name = $name AND entityType = $type',
    { name, type: 'Project' }
  );
  return (result && result.length > 0) ? result[0] : null;
}

/**
 * Get all milestones for a project.
 * @param {string} projectName - Project name
 * @returns {Promise<Object[]>}
 */
export async function getProjectMilestones(projectName) {
  return searchMilestones({ project: projectName });
}

/**
 * Get all tasks for a milestone.
 * @param {string} milestoneName - Milestone name
 * @returns {Promise<Object[]>}
 */
export async function getMilestoneTasks(milestoneName) {
  return searchTasks({ milestone: milestoneName });
}

/**
 * Get tasks that are blocked by a specific task.
 * @param {string} taskName - Task name
 * @returns {Promise<Object[]>}
 */
export async function getTasksBlockedBy(taskName) {
  const db = getDb();
  const [result] = await db.query(
    `SELECT * FROM entity 
     WHERE entityType = 'Task' 
     AND $taskName IN metadata.blockedBy`,
    { taskName }
  );
  return result || [];
}

/**
 * Format projects as vtasks.md style table.
 * @param {Object} options - Optional filters (category)
 * @returns {Promise<string>} Markdown table
 */
export async function formatAsVtasks(options = {}) {
  const allProjects = await searchProjects(options.category ? { category: options.category } : {});
  
  // Only show projects with metadata (actively managed vtasks)
  const projects = allProjects.filter(p => p.metadata);
  
  if (projects.length === 0) {
    return 'No projects found.';
  }
  
  // Group by category
  const personal = projects.filter(p => p.metadata?.category === 'Personal');
  const work = projects.filter(p => p.metadata?.category === 'Work');
  const other = projects.filter(p => !p.metadata?.category || 
    (p.metadata.category !== 'Personal' && p.metadata.category !== 'Work'));
  
  let output = '# VTASKS — Agent Task Board\n\n';
  output += `Last Updated: ${new Date().toISOString().split('T')[0]}\n\n`;
  output += '---\n\n';
  
  // Helper to get status emoji
  const getStatusEmoji = (status) => {
    const map = {
      'Complete': '✅',
      'Active': '🔴',
      'In Progress': '🔴',
      'Ready': '🟡',
      'Not Started': '🟡',
      'On Hold': '⏸️',
      'Blocked': '🔴'
    };
    return map[status] || '🟡';
  };
  
  // Helper to extract project ID from name
  const getProjectId = (name) => {
    const match = name.match(/^(P\d+)/);
    return match ? match[1] : '—';
  };
  
  // Format section
  const formatSection = (title, projects) => {
    if (projects.length === 0) return '';
    
    let section = `## ${title}\n\n`;
    section += '| ID | Project | Status | Next Action | Notes |\n';
    section += '|----|---------|--------|-------------|-------|\n';
    
    for (const p of projects) {
      const id = getProjectId(p.name);
      const name = p.name.replace(/^P\d+\s*[-–]\s*/, '').replace(/^P\d+\s+/, '');
      const status = p.metadata?.status || 'Unknown';
      const emoji = getStatusEmoji(status);
      const statusText = `${emoji} ${status}`;
      const nextAction = p.metadata?.nextAction || '—';
      const priority = p.metadata?.priority ? `Priority: ${p.metadata.priority}` : '';
      const notes = p.observations?.[0] || '';
      const combined = [priority, notes].filter(Boolean).join('. ');
      
      section += `| **${id}** | **${name}** | ${statusText} | ${nextAction} | ${combined} |\n`;
    }
    
    section += '\n---\n\n';
    return section;
  };
  
  if (personal.length > 0) {
    output += formatSection('🔵 PERSONAL PROJECTS (Priority Order)', personal);
  }
  
  if (work.length > 0) {
    output += formatSection('🟠 WORK PROJECTS (Priority Order)', work);
  }
  
  if (other.length > 0) {
    output += formatSection('📋 OTHER PROJECTS', other);
  }
  
  // Summary
  output += '## 📊 Summary Stats\n\n';
  output += `- **Personal Projects:** ${personal.length} active\n`;
  output += `- **Work Projects:** ${work.length} active\n`;
  output += `- **Other Projects:** ${other.length} active\n`;
  output += `- **Total Active:** ${projects.length} projects\n\n`;
  
  return output;
}

/**
 * Format project roadmap (milestones and tasks).
 * @param {string} projectName - Project name
 * @returns {Promise<string>} Markdown roadmap
 */
export async function formatProjectRoadmap(projectName) {
  const project = await getProject(projectName);
  if (!project) {
    return `Project "${projectName}" not found.`;
  }
  
  const milestones = await getProjectMilestones(projectName);
  
  let output = `# ${project.name} Roadmap\n\n`;
  output += `**Status:** ${project.metadata?.status || 'Unknown'}\n`;
  output += `**Priority:** ${project.metadata?.priority || 'Unknown'}\n\n`;
  
  if (project.observations && project.observations.length > 0) {
    output += `## Overview\n\n${project.observations.join('\n')}\n\n`;
  }
  
  if (milestones.length === 0) {
    output += '## Milestones\n\nNo milestones defined.\n';
    return output;
  }
  
  output += '## Milestones\n\n';
  
  for (const milestone of milestones) {
    output += `### ${milestone.name}\n\n`;
    output += `- **Status:** ${milestone.metadata?.status || 'Unknown'}\n`;
    output += `- **Due:** ${milestone.metadata?.dueDate || 'Not set'}\n`;
    output += `- **Progress:** ${milestone.metadata?.progress || 'Unknown'}\n\n`;
    
    const tasks = await getMilestoneTasks(milestone.name);
    
    if (tasks.length > 0) {
      output += '**Tasks:**\n\n';
      for (const task of tasks) {
        const status = task.metadata?.status || 'Unknown';
        const assignee = task.metadata?.assignee || 'Unassigned';
        const checkbox = status === 'Done' ? '[x]' : '[ ]';
        output += `- ${checkbox} ${task.name} (${assignee}, ${status})\n`;
      }
      output += '\n';
    }
  }
  
  return output;
}
