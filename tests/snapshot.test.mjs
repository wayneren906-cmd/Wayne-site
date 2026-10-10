import test from "node:test";
import assert from "node:assert/strict";
import { snapshot } from "../lib/database.ts";

test("both scheduled times save the same study day without creating entries", async () => {
  const writes=[];
  const db={prepare(sql){return {
    async all(){assert.ok(sql.startsWith("SELECT"));return {results:[]};},
    bind(...values){return {async run(){writes.push({sql,values});return {meta:{changes:1}};}};},
  };}};
  const evening=await snapshot(db,new Date("2026-10-09T23:00:00+08:00"));
  const morning=await snapshot(db,new Date("2026-10-10T05:55:00+08:00"));
  assert.equal(evening.snapshotDate,"2026-10-09");
  assert.equal(morning.snapshotDate,"2026-10-09");
  assert.equal(evening.count,0);
  assert.equal(writes.length,2);
  assert.ok(writes.every(w=>w.sql.startsWith("INSERT INTO snapshots")));
  assert.ok(writes.every(w=>w.sql.includes("WHERE excluded.updated_at >= snapshots.updated_at")));
  assert.deepEqual(JSON.parse(writes[1].values[1]),[]);
});
