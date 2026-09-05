import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // schemas/ and prompts/ are runtime volume mounts and are empty in the repo; the
        // loader unit tests run against dedicated fixtures instead.
        env: {
            SCHEMA_DIR: './test/fixtures/schemas',
            PROMPTS_DIR: './test/fixtures/prompts'
        }
    }
});
