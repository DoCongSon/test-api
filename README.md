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
- `GET /hello/secure` — requires a valid Firebase ID token or session cookie and greets the authenticated user.
- `POST /auth/session` — exchanges a Firebase ID token for a long-lived session cookie and returns the user profile.
- `GET /auth/me` — returns the current authenticated user (ID or session token required).
- `DELETE /auth/session` — revokes refresh tokens for the authenticated user and clears the session cookie.

## Logging

Structured logging is provided by [Pino](https://github.com/pinojs/pino). Pretty printing is enabled automatically in non-production environments. Authentication flows enrich log lines with `uid` (and IP on failures) so traces in Application Insights surface the acting user via `customDimensions.uid`.

## Monitoring with Azure Application Insights

The API emits telemetry to Azure Application Insights when `APPLICATIONINSIGHTS_CONNECTION_STRING` is configured. Use the Azure Portal to inspect health, logs, and performance:

- **Open the resource** — In the Azure Portal search for "Application Insights" and select the instance linked to your environment.
- **Overview blade** — Check request rate, response times, and failure count summaries. Select any chart to drill into the underlying data.
- **Live Metrics** — Use the Live Metrics Stream for near-real-time visibility into requests, dependencies, and server health. Useful when rolling out new releases.
- **Log Analytics** — Open the Logs tab to run Kusto queries. For example, recent server errors:
  ```kusto
  requests
  | where timestamp > ago(1h)
  | where success == false
  | project timestamp, name, resultCode, operation_Id, cloud_RoleName
  ```
  Switch to the `traces` table to explore structured logs emitted via the Pino integration.
- **Business telemetry** — Custom events capture authentication outcomes:
  ```kusto
  customEvents
  | where name in ('UserLoginSuccess', 'UserLoginFailed', 'UserLogout')
  | project timestamp, name, customDimensions.uid, customDimensions.email, customDimensions.provider, customDimensions.ip, customDimensions.errorMsg
  ```
  Filter by `customDimensions.uid` to follow a specific user journey or join against `traces` on the same `operation_Id` for full context.
- **Transaction search** — The Failures blade surfaces exceptions and dependency errors. Drill into a failed request to see correlated traces, dependencies, and custom logs.
- **Dashboards & Workbooks** — Pin tiles from the Metrics or Logs views to dashboards for ongoing monitoring. Workbooks offer richer visualizations and sharing with the team.
- **Alerts** — Create metric alerts (for example high failure rate or CPU usage) or log alerts (for specific error patterns) to receive email/Teams notifications when thresholds are breached.

> ℹ️ Ensure your deployment (App Service, AKS, or other host) sets `APPLICATIONINSIGHTS_CONNECTION_STRING` via environment variables or secrets. Re-deploy if you rotate the connection string.

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

## Authentication Setup

The API relies on the Firebase Admin SDK for identity verification.

1. Create a service account in the Firebase console and generate a JSON key.
2. Populate the following environment variables (see `.env.example`):
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (escape newlines as `\n` when storing in `.env` files)
   - `SESSION_MAX_AGE_DAYS` (optional, defaults to 7 days)
3. Provide clients with Firebase ID tokens (via Firebase Authentication SDK). The backend accepts tokens in the `Authorization: Bearer <token>` header or via the `session` cookie.
4. To create HTTP-only sessions, call `POST /auth/session` with `{ "idToken": "<firebase-id-token>", "remember": true }`. The response contains the session cookie and user payload.
5. Attach the returned cookie (or the original ID token) to protected requests. Example:
   ```bash
   curl -H "Authorization: Bearer <ID_TOKEN>" http://localhost:3000/hello/secure
   ```
6. Revoke sessions with `DELETE /auth/session` to invalidate refresh tokens across devices.

For Kubernetes or container deployments, set these variables as secrets. Session cookies default to `SameSite=Lax`, `HttpOnly`, and `Secure` (when `NODE_ENV !== development`).

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

## Custom Domains & TLS Certificates

### Azure Web App

1. Point your domain to the Web App: create a DNS CNAME record for the subdomain pointing to `<app-name>.azurewebsites.net` or an A record if you have a static IP via Azure Front Door/Application Gateway.
2. Bind the hostname:
   ```bash
   az webapp config hostnames add \
      --resource-group testapi-rg \
      --name testapi-web \
      --hostname api.example.com
   ```
3. Request an Azure-managed certificate (free, single-domain) once DNS is validated:
   ```bash
   az webapp config ssl create \
      --resource-group testapi-rg \
      --name testapi-web \
      --hostname api.example.com
   az webapp config ssl bind \
      --resource-group testapi-rg \
      --name testapi-web \
      --certificate-thumbprint <THUMBPRINT> \
      --ssl-type SNI
   ```
   > 🔐 Managed certificates renew automatically; if you supply your own certificate (`.pfx`), upload it with `az webapp config ssl upload` and track expiry manually.

### AKS Ingress (NGINX + cert-manager)

1. After ingress is provisioned, note its public IP/hostname:
   ```bash
   kubectl get ingress api-ingress
   ```
   Create an A record for `api.example.com` pointing to that IP (or CNAME to the hostname).
2. Install cert-manager (once per cluster):
   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.1/cert-manager.yaml
   ```
3. Define a ClusterIssuer for Let’s Encrypt (replace contact email):
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: ClusterIssuer
   metadata:
     name: letsencrypt-prod
   spec:
     acme:
       email: ops@example.com
       server: https://acme-v02.api.letsencrypt.org/directory
       privateKeySecretRef:
         name: letsencrypt-prod
       solvers:
         - http01:
             ingress:
               class: nginx
   ```
   Apply it with `kubectl apply -f clusterissuer.yaml`.
4. Request a certificate for your domain (assumes ingress uses namespace `default`):
   ```yaml
   apiVersion: cert-manager.io/v1
   kind: Certificate
   metadata:
     name: api-example-com
     namespace: default
   spec:
     secretName: api-example-com-tls
     dnsNames:
       - api.example.com
     issuerRef:
       name: letsencrypt-prod
       kind: ClusterIssuer
   ```
   Apply with `kubectl apply -f certificate.yaml`.
5. Update `ingress.yaml` to reference the generated secret:
   ```yaml
   spec:
      tls:
         - hosts:
               - api.example.com
            secretName: api-example-com-tls
   ```
6. Monitor certificate status:
   ```bash
   kubectl describe certificate api-example-com
   kubectl get secret api-example-com-tls
   ```

> ✅ cert-manager renews certificates automatically. Ensure DNS remains pointed at the ingress IP and that ports 80/443 are open.
