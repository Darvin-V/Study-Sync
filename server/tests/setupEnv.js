/**
 * StudySync AI — Test Environment Setup Preload
 * 
 * Sets test environment variables BEFORE any application modules are evaluated.
 * Guarantees that all test fixtures run against an isolated test database
 * and never pollute the persistent production/development database.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = process.env.DATABASE_PATH || './server/data/test.db';
