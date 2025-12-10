# Test API

Production-ready Node.js + TypeScript Express API with health and hello endpoints.

## Prerequisites

- Node.js 18.17 or newer
- npm 9 or newer

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and adjust values as needed.
3. Start the development server:
   ```bash
   npm run dev
   ```

The API listens on the host and port configured in your environment variables (defaults to `0.0.0.0:3000`).

## Available Scripts

- `npm run dev` — start the development server with live reload via ts-node-dev.
- `npm run build` — compile TypeScript sources to `dist/`.
- `npm start` — run the compiled production build.
- `npm test` — execute Jest unit tests.
- `npm run lint` — lint the codebase with ESLint.
- `npm run lint:fix` — fix lint issues automatically when possible.

## API Endpoints

- `GET /health` — returns service status and uptime metadata.
- `GET /hello?name=YourName` — returns a greeting, defaulting to `world` if `name` is omitted.

## Logging

Structured logging is provided by [Pino](https://github.com/pinojs/pino). Pretty printing is enabled automatically in non-production environments.

## Project Structure

```
src/
  app.ts          # Express app wiring and middleware
  server.ts       # HTTP server bootstrap and shutdown hooks
  config/env.ts   # Environment variable parsing and validation
  controllers/    # Route handlers
  routes/         # Express routers
  lib/logger.ts   # Pino logger configuration
```

## Testing

Tests are located under `tests/` and leverage Jest with Supertest for HTTP assertions:

```bash
npm test
```

## Building for Production

```bash
npm run build
npm start
```

The build artifacts are emitted to the `dist/` directory and can be deployed independently.

## Docker

Build and run the container image locally:

```bash
docker build -t test-api:latest .
docker run --rm -p 3000:3000 test-api:latest
```

Override runtime configuration using environment variables, for example:

```bash
docker run --rm -p 4000:3000 -e PORT=3000 -e LOG_LEVEL=info test-api:latest
```
