import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // schemas/ is a runtime volume mount and is empty in the repo; the schema-pipeline
        // unit tests run against dedicated fixtures instead.
        env: {
            SCHEMA_DIR: './test/fixtures/schemas'
        }
    }
});
