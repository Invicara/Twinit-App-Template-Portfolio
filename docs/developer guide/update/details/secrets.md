# Secrets and Mapbox

A new encrypted NamdeUserCollection was added with a _userType of 'secrets'. This collection is currently used to store an item with a Mapbox user name (unencrypted) and a secret token (encrypted).

The secret token is retrieved by the Mapbox crip run by the Mapbox orchestrator and used to fetch a temporary Mapbox token for use in the client IafViewer model viewer. 

See [In-Depth: Handling Secrets and the Mapbox Token Workflow](../../implementation/imp-secrets.md) for more information.

---
[Developer Update Guide](../README.md) < Back