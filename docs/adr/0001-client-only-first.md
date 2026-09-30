# Client-only first, storage behind an abstraction

The app runs entirely in the browser in v1 (IndexedDB/localStorage) with no backend, even though we expect to deploy it as a shared web app later. We chose this to iterate fast on the balancing logic and UI; all persistence goes through a storage interface so a backend (API + database) can replace it when the app needs shared, multi-user data.

**Status**: superseded by ADR-0007. The client-only phase this records is complete, and the storage abstraction it chose is what the backend now attaches to; the decision below is preserved as the reasoning for that phase and still describes the guest experience exactly.

**Considered Options**:
- Backend from day one: deploy-ready sooner, but more upfront work and slower iteration
- Client-only first: fastest iteration, but local data must be migrated when a backend lands

**Consequences**:
- Data is single-browser; multi-user coordination is deferred until deployment
- Export/import of sessions will be needed to move data to a server later
