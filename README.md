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

## Deploying to Azure Web App

1. Ensure you are signed in with the Azure CLI:
   ```bash
   az login
   ```
2. Create the resource group and App Service plan (Linux, Node 18 runtime):
   ```bash
   az group create --name testapi-rg --location eastus
   az appservice plan create --name testapi-plan --resource-group testapi-rg --sku B1 --is-linux
   az webapp create \
     --name testapi-web \
     --resource-group testapi-rg \
     --plan testapi-plan \
     --runtime "NODE|18-lts"
   ```
3. Configure environment variables expected by the API:
   ```bash
   az webapp config appsettings set \
     --resource-group testapi-rg \
     --name testapi-web \
     --settings PORT=3000 NODE_ENV=production LOG_LEVEL=info
   ```
4. Build the project locally and package it for deployment (Zip Deploy keeps the node_modules installation on the server):
   ```bash
   npm install
   npm run build
   zip -r release.zip package.json package-lock.json dist
   az webapp deploy --resource-group testapi-rg --name testapi-web --src-path release.zip --type zip
   ```
5. Verify that the app responds:
   ```bash
   az webapp browse --resource-group testapi-rg --name testapi-web
   ```

> ℹ️ App Service automatically runs `npm install` in production mode. The `npm start` script launches `dist/server.js`, so no custom startup command is required.

## Deploying to Azure Kubernetes Service (AKS)

1. Make sure you have an Azure Container Registry (ACR) and AKS cluster, and both are in the same resource group (sample names are used below):
   ```bash
   az acr create --resource-group testapi-rg --name testapiacr --sku Basic
   az aks create --resource-group testapi-rg --name testapi-aks --attach-acr testapiacr --node-count 1 --generate-ssh-keys
   ```
2. Build and push the container image referenced by `deployment.yaml` (update the image name/tag to match your registry):
   ```bash
   az acr login --name testapiacr
   docker build -t testapiacr.azurecr.io/test-api:v1 .
   docker push testapiacr.azurecr.io/test-api:v1
   ```
3. Get AKS credentials and apply the Kubernetes manifests:
   ```bash
   az aks get-credentials --resource-group testapi-rg --name testapi-aks
   kubectl apply -f deployment.yaml
   ```
4. Monitor rollout and service status:
   ```bash
   kubectl get pods
   kubectl get svc api-service
   ```
5. For local verification, port-forward the ClusterIP service and call the API:
   ```bash
   kubectl port-forward svc/api-service 8080:80
   curl http://localhost:8080/health
   ```

> ✅ Update `deployment.yaml` before every release to point to the correct container tag (for example `testapiacr.azurecr.io/test-api:v1`). Adjust CPU/memory requests to reflect production sizing needs. The sample commands assume a Dockerfile at the repository root; adapt them if your containerization workflow differs.

### Exposing the API Externally with Ingress

Once the workload is healthy, configure external access with the provided `ingress.yaml` (which targets the `api-service` on port 80):

1. Ensure an ingress controller is installed in the cluster (for example the [NGINX ingress add-on](https://learn.microsoft.com/azure/aks/ingress-basic?tabs=azure-cli)). For AKS you can enable it via:
   ```bash
   az aks addon enable --resource-group testapi-rg --name testapi-aks --addon ingress-nginx
   ```
   or install the OSS NGINX controller with Helm:
   ```bash
   helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
   helm repo update
   helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
     --namespace ingress-nginx --create-namespace
   ```
2. Deploy the ingress resource:
   ```bash
   kubectl apply -f ingress.yaml
   kubectl get ingress api-ingress
   ```
3. Wait for an external IP or hostname to be provisioned (check in `kubectl get ingress` output). Once available, call the API through the ingress endpoint:
   ```bash
   curl http://<EXTERNAL_HOSTNAME_OR_IP>/health
   ```
4. To serve a custom domain, create an A record pointing to the ingress IP or configure the DNS name provided by your ingress controller. Use TLS certificates (for example via cert-manager + Let’s Encrypt) for production traffic.
