import { defineConfig } from "prisma/config";
import dotenv from "dotenv";

dotenv.config({ path: "../.env", override: true });

export default defineConfig({
  schema: "./schema.prisma",
  migrations: {
    path: "./migrations",
    seed: "../node_modules/.bin/ts-node ./seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
