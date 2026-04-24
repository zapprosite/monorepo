# apps/api Rules

Backend API development guidelines.

## Safe
- Adding endpoints
- Adding middleware
- Refactoring existing logic
- Tests and documentation
- Dependency additions

## Caution
- Breaking API changes (deprecate first)
- Removing endpoints
- Database schema changes

## Forbidden
- Hardcoded API keys
- Credentials in code
- Removing error handling
- Reading secrets directly from  (use .env after sync instead)
