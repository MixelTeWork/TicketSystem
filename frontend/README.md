# TicketSystem frontend

## Local development

Use Node.js 22 or newer. Run the backend on `http://127.0.0.1:5001`, then:

```sh
npm ci
npm start
```

Vite proxies `/api` requests to the backend. The app is available at `http://localhost:5173`.

## Checks and build

```sh
npm run lint
npm test
npm run build
```

The production build is written to `build/` and deployed with the Flask backend by the GitHub Actions workflow.

The `browserslist` settings in `package.json` control the JavaScript build target and CSS prefixes. Hashed assets are written to `build/static/` for the backend's cache policy.

`public/frontend-error.js` loads before the application to report startup errors and unhandled promise rejections to `/api/frontend_error`.

## API layer

API modules own their request/response types and query-key functions. `api/dataTypes.ts` re-exports domain types for existing components. Use `stdQuery` / `itemQuery` and the mutation factories in `utils/mutations.ts` for ordinary endpoints; keep custom hooks for authentication, scanning, multipart uploads, and paginated prefetching.

Date conversion runs before storing responses in the query cache. IDs in item keys are strings, so route parameters and numeric IDs share the same cache. Mutations update loaded lists and invalidate related statistics and administrative views before calling the component callback. List responses seed detail queries without overwriting newer detail data.

The HTTP helpers read `csrf_access_token` for each write, including multipart uploads, and expose HTTP status through `ApiError`. Query functions pass an abort signal to fetch. Login and logout cancel pending queries and remove data from the previous session.
