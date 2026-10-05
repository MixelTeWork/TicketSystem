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
