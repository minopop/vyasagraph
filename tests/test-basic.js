/**
 * Basic CRUD tests for VyasaGraph v2.
 */

import { init, close, createEntities, addObservations, deleteEntities,
         getEntity, updateEntity, getAllEntities, createRelations,
         deleteRelations, getRelations, getAllRelations, getStats } from '../src/index.js';

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

async function run() {
  console.log('VyasaGraph v2 - Basic CRUD Tests\n');

  try {
    // 1. Initialize (in-memory for tests)
    console.log('--- Initialization ---');
    await init(null, { memory: true });
    assert(true, 'Database initialized');

    // 2. Create entities
    console.log('\n--- Create Entities ---');
    const createResult = await createEntities([
      { name: 'Alice', entityType: 'Person', observations: ['Engineer', 'Lives in London'] },
      { name: 'Bob', entityType: 'Person', observations: ['Designer'] },
      { name: 'OpenClaw', entityType: 'Organization', observations: ['AI company'] }
    ]);
    assert(createResult.created === 3, `Created 3 entities (got ${createResult.created})`);
    assert(createResult.errors.length === 0, `No creation errors`);

    // 3. Duplicate entity should fail
    const dupResult = await createEntities([{ name: 'Alice', entityType: 'Person' }]);
    assert(dupResult.created === 0, 'Duplicate entity rejected');
    assert(dupResult.errors.length === 1, 'Duplicate produces error');

    // 4. Get entity
    console.log('\n--- Get Entity ---');
    const alice = await getEntity('Alice');
    assert(alice !== null, 'Found Alice');
    assert(alice.name === 'Alice', 'Name matches');
    assert(alice.entityType === 'Person', 'Type matches');
    assert(Array.isArray(alice.observations), 'Observations is array');
    assert(alice.observations.length === 2, `Has 2 observations (got ${alice.observations.length})`);

    const notFound = await getEntity('NonExistent');
    assert(notFound === null, 'Non-existent returns null');

    // 5. Get all entities
    console.log('\n--- Get All Entities ---');
    const all = await getAllEntities();
    assert(all.length === 3, `Got all 3 entities (got ${all.length})`);

    // 6. Add observations
    console.log('\n--- Add Observations ---');
    const obsResult = await addObservations([
      { entityName: 'Alice', contents: ['Speaks French', 'Age 30'] }
    ]);
    assert(obsResult.updated === 1, 'Updated 1 entity');
    const aliceUpdated = await getEntity('Alice');
    assert(aliceUpdated.observations.length >= 4, `Alice has 4+ observations (got ${aliceUpdated.observations.length})`);

    // 7. Update entity
    console.log('\n--- Update Entity ---');
    const updated = await updateEntity('Bob', { entityType: 'Designer' });
    assert(updated !== null, 'Update returned result');
    const bob = await getEntity('Bob');
    assert(bob.entityType === 'Designer', 'Entity type updated');

    // 8. Create relations
    console.log('\n--- Create Relations ---');
    const relResult = await createRelations([
      { from: 'Alice', to: 'Bob', relationType: 'knows' },
      { from: 'Alice', to: 'OpenClaw', relationType: 'works_at' },
      { from: 'Bob', to: 'OpenClaw', relationType: 'works_at' }
    ]);
    assert(relResult.created === 3, `Created 3 relations (got ${relResult.created})`);

    // 9. Get relations for entity
    console.log('\n--- Get Relations ---');
    const aliceRels = await getRelations('Alice');
    assert(aliceRels.length >= 2, `Alice has 2+ relations (got ${aliceRels.length})`);

    const allRels = await getAllRelations();
    assert(allRels.length === 3, `Total 3 relations (got ${allRels.length})`);

    // 10. Relation to non-existent entity
    const badRel = await createRelations([{ from: 'Alice', to: 'Ghost', relationType: 'knows' }]);
    assert(badRel.created === 0, 'Relation to non-existent entity rejected');

    // 11. Delete relations
    console.log('\n--- Delete Relations ---');
    const delRel = await deleteRelations([{ from: 'Bob', to: 'OpenClaw' }]);
    assert(delRel.deleted === 1, 'Deleted 1 relation');

    // 12. Get stats
    console.log('\n--- Stats ---');
    const stats = await getStats();
    assert(stats.entityCount === 3, `Entity count: 3 (got ${stats.entityCount})`);
    assert(stats.relationCount === 2, `Relation count: 2 (got ${stats.relationCount})`);

    // 13. Delete entity (should cascade relations)
    console.log('\n--- Delete Entity ---');
    const delResult = await deleteEntities(['Bob']);
    assert(delResult.deleted === 1, 'Deleted Bob');

    const statsAfter = await getStats();
    assert(statsAfter.entityCount === 2, `Entity count after delete: 2 (got ${statsAfter.entityCount})`);

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
