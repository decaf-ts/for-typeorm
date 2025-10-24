![Banner](./workdocs/assets/decaf-logo.svg)

# Decaf.ts — TypeORM Integration

A thin, focused TypeORM-backed adapter that plugs Decaf.ts models, repositories and query primitives into relational databases via TypeORM, keeping the same API you use across other Decaf adapters. It provides:
- TypeORMAdapter: connection management, CRUD/bulk ops, raw SQL, schema helpers, sequences, indexes, error translation
- TypeORMRepository: typed CRUD with validation, context/flags, observers, and access to the native TypeORM repository
- Query layer: TypeORMStatement and TypeORMPaginator for translating Decaf statements to TypeORM options/builders and paginating results
- Decorator wiring: automatically wires Decaf decorators to TypeORM metadata on import (no need to use TypeORM decorators directly)
- Utilities and types: constants, operator translation, raw Postgres types, and small helpers like convertJsRegexToPostgres
