/**
 * Vector search tests for VyasaGraph v2.
 */

import { init, close, createEntities, searchNodes, searchText,
         openNodes, readGraph } from '../src/index.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.log(`  FAIL: ${message}`);
    failed++;
  }
}

/**
 * Generates a deterministic pseudo-random 1536-dim embedding based on a seed.
 * Entities with similar seeds will have similar embeddings.
 */
function makeEmbedding(seed, noise = 0) {
  const emb = new Array(1536);
  for (let i = 0; i < 1536; i++) {
    emb[i] = Math.sin(seed * 1000 + i * 0.1) * 0.5 + noise * Math.cos(i * 0.3 + seed);
  }
  const mag = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
  return emb.map(v => v / mag);
}

async function run() {
  console.log('VyasaGraph v2 - Vector Search Tests\n');

  try {
    await init(null, { memory: true });
    assert(true, 'Database initialized');

    // Create entities with embeddings
    console.log('\n--- Create Entities with Embeddings ---');
    const entities = [
      { name: 'JavaScript', entityType: 'Language', observations: ['Dynamic typed', 'Web language'], embedding: makeEmbedding(1) },
      { name: 'TypeScript', entityType: 'Language', observations: ['Static typed', 'Superset of JS'], embedding: makeEmbedding(1, 0.05) },
      { name: 'Python', entityType: 'Language', observations: ['Dynamic typed', 'ML language'], embedding: makeEmbedding(2) },
      { name: 'Rust', entityType: 'Language', observations: ['Systems language', 'Memory safe'], embedding: makeEmbedding(3) },
      { name: 'SurrealDB', entityType: 'Database', observations: ['Multi-model', 'Graph + vector'], embedding: makeEmbedding(4) },
      { name: 'NoEmbedding', entityType: 'Test', observations: ['No embedding stored'] }
    ];

    const result = await createEntities(entities);
    assert(result.created === 6, `Created 6 entities (got ${result.created})`);

    // Vector search - query similar to JavaScript (seed=1)
    console.log('\n--- Vector Similarity Search ---');
    const queryEmb = makeEmbedding(1, 0.01); // Very close to JS/TS
    const vectorResults = await searchNodes(queryEmb, 3);
    assert(vectorResults.length > 0, `Got vector results (${vectorResults.length})`);

    if (vectorResults.length >= 2) {
      const topNames = vectorResults.map(r => r.name);
      assert(
        topNames.includes('JavaScript') || topNames.includes('TypeScript'),
        `Top results include JS or TS: [${topNames.join(', ')}]`
      );
    }

    // Vector search - bad input
    console.log('\n--- Vector Search Validation ---');
    try {
      await searchNodes([1, 2, 3], 5);
      assert(false, 'Should reject wrong dimension');
    } catch (e) {
      assert(e.message.includes('1536'), 'Rejects non-1536 vectors');
    }

    // Text search
    console.log('\n--- Text Search ---');
    const textResults = await searchText('Type', 5);
    assert(textResults.length > 0, `Text search found results (${textResults.length})`);

    // Open nodes
    console.log('\n--- Open Nodes ---');
    const opened = await openNodes(['JavaScript', 'Python']);
    assert(opened.entities.length === 2, `Opened 2 entities (got ${opened.entities.length})`);

    // Read full graph
    console.log('\n--- Read Graph ---');
    const graph = await readGraph();
    assert(graph.entities.length === 6, `Full graph has 6 entities (got ${graph.entities.length})`);
    assert(Array.isArray(graph.relations), 'Graph has relations array');

    // Summary
    console.log(`\n========================================`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

  } catch (e) {
    console.error('Test error:', e);
    failed++;
  } finally {
    try { await close(); } catch {}
  }

  process.exit(failed > 0 ? 1 : 0);
}

run();
