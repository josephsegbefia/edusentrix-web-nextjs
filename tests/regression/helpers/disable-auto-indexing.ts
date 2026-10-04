import mongoose from "mongoose";

/**
 * Non-production connections enable autoIndex, so every compiled model runs a
 * background Model.init() that creates its collection and indexes. In tests that
 * would race dropDatabase/dropIndex and make index state nondeterministic.
 * Must be called after the models under test are imported and before connecting.
 */
export function disableAutoIndexing() {
  for (const name of mongoose.modelNames()) {
    const schema = mongoose.model(name).schema;
    schema.set("autoIndex", false);
    schema.set("autoCreate", false);
  }
}
