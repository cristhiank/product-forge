# Feature Modules and API Clients

## Feature Module Structure

Each feature folder follows the same structure:

```
features/<feature>/
  index                     # Public surface (barrel file)
  routes/
    <n>-route
  components/
    *.component
  api/
    *-client
  hooks/
    use-something
  types/
    *.types
```

## Public Surface

Each feature has a barrel file that re-exports what other parts of the app are allowed to use. Typically this is just the route definitions.

Only the barrel file should be imported from outside the feature folder.

**Forbidden:** Importing a feature's internal component, hook, or API client from another feature. Always import from the barrel file.

## Shared API Client

A single shared API client is the only place that talks to the network for backend requests.

Responsibilities:
- Set base URL and credentials policy
- Attach standard headers (locale, correlation IDs, etc.)
- Handle structured error responses from the backend
- Map HTTP status codes to typed error objects
- Trigger auth redirect on 401 when appropriate

No other module should make raw HTTP calls for backend communication.

## Feature API Clients

Each feature has one or more API client files under its `api/` folder.

Rules:
- Only API client files call the shared client's helper functions
- Route loaders and actions call the feature's client functions, not the shared client directly
- Types in the feature's `types/` folder represent view models and UI contracts
- When the backend DTO shape differs from what the UI needs, the mapping happens in the API client, not in components
