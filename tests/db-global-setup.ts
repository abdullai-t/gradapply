import {
  disconnectTestDatabase,
  migrateTestDatabaseOnce,
} from "./helpers/prisma-test-db";

export default async function globalSetup() {
  migrateTestDatabaseOnce();
  return async () => {
    await disconnectTestDatabase();
  };
}
