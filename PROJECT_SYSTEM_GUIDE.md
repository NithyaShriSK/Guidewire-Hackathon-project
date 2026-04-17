# GigShield System Guide (Single Compose Setup)

This file explains what the project does, all major features, what each part is used for, and how to run everything with only docker-compose.yml.

## 1. What This Project Is

GigShield is an AI-enabled parametric insurance platform for gig workers.
It provides weekly premium-based coverage and can trigger claims based on objective environmental data such as weather, pollution, and traffic.

Primary users:
- Workers: register, manage profile, buy/activate coverage, monitor risk, raise claims.
- Admins: manage workers, review claims, monitor fraud and payouts, run simulations.

## 2. High-Level Architecture

Backend:
- Node.js + Express API server.
- MongoDB for core data persistence.
- Redis for caching and short-lived runtime data.
- JWT-based auth with worker/admin role separation.

Frontend:
- React app with protected worker and admin routes.
- Tailwind-based UI and chart/analytics components.

Infrastructure:
- Docker Compose orchestration in one file.
- Nginx container exposed on 80/443.

## 3. Single Compose File Workflow

The project now supports running everything from docker-compose.yml only.

Services started:
- mongodb
- redis
- backend
- frontend
- nginx

Run commands:
- docker compose down --remove-orphans
- docker compose up -d
- docker compose ps

## 4. Local URLs and Ports

Application URLs:
- Frontend UI: http://localhost:3001
- Backend API base: http://localhost:5000/api
- Health endpoint: http://localhost:5000/api/health
- Nginx entrypoint: http://localhost

Port mapping summary:
- 3001 -> frontend container 3000
- 5000 -> backend container 5000
- 27017 -> mongodb container 27017
- 6379 -> redis container 6379
- 80/443 -> nginx container 80/443

## 5. Main Product Features

Worker-facing features:
- Worker registration/login and onboarding.
- Worker profile and location tracking updates.
- Weekly premium status check and premium payment.
- Dynamic premium tiers based on location/work risk factors.
- Policy creation, activation, cancellation, and analytics.
- Claim creation and claim history/analytics.
- Monitoring start/stop/status and location-based threat checks.

Admin-facing features:
- Admin registration/login/profile.
- Dashboard statistics for workers, policies, claims, payouts.
- Worker listing/detail/status updates.
- Policy listing across workers.
- Claim review queue, approval/rejection/refund, payout analytics.
- Fraud statistics and worker risk analysis.
- Geographic overview for active workers and live conditions.
- Simulation engine to generate demo scenarios and payouts.

Automation features:
- Autonomous engine starts with backend server.
- Monitoring service evaluates threshold breaches.
- Claim and payout services support automatic decision paths.

## 6. What Each API Area Is Used For

Auth routes (/api/auth):
- Worker and admin authentication.
- Worker onboarding/profile completion actions.
- Unified profile retrieval endpoint.

Worker routes (/api/workers):
- Worker profile read/update.
- Location updates while working.
- Weekly premium lifecycle and tiered payment flows.
- Admin worker management endpoints.

Policy routes (/api/policies):
- Create and manage worker policies.
- Policy analytics for workers.
- Admin read-all policy endpoint.

Claim routes (/api/claims):
- Worker claim creation and status tracking.
- Claim analytics and payout retry.
- Admin review pipelines, fraud stats, payout batch/refund actions.

Monitoring routes (/api/monitoring):
- Current environmental data by type.
- Worker monitoring start/stop/status.
- Current location risk threshold checks.
- Admin location monitoring and start-all actions.

Admin routes (/api/admin):
- Admin profile + dashboard stats.
- Geographic data aggregation and worker deep-dive endpoints.
- Admin management functions (permission-gated).

Simulation routes (/api/simulation):
- Demo scenario execution with synthetic trigger conditions.
- Demo-ready worker/policy claim generation for presentations.

## 7. Frontend Route Map and Usage

Public routes:
- /login
- /register

Worker app routes:
- /dashboard
- /policies
- /claims
- /weekly-premium
- /profile

Admin app routes:
- /admin/dashboard
- /admin/workers
- /admin/policies
- /admin/claims
- /admin/simulation
- /admin/geographic
- /admin/settings

## 8. Data and Security Notes

Security controls in backend:
- Helmet headers.
- CORS restriction by environment.
- Rate limiting on API requests.
- Input validation via validators.
- JWT auth middleware for worker/admin separation.
- Permission checks on sensitive admin endpoints.

Operational notes:
- Backend serves React build statically for catch-all routes.
- Health endpoint exposed for container health checks.
- MongoDB init script mounted via file bind.
- Nginx config mounted via file bind.

## 9. Important Environment Variables

Core runtime:
- NODE_ENV
- PORT
- MONGODB_URI
- REDIS_URL
- JWT_SECRET
- JWT_EXPIRE

External providers:
- WEATHER_API_KEY
- POLLUTION_API_KEY
- TRAFFIC_API_KEY
- UPI_MERCHANT_ID
- UPI_API_KEY

Optional networking:
- TRUST_PROXY

## 10. Typical Demo Flow

1. Start stack: docker compose up -d
2. Open frontend: http://localhost:3001
3. Login as worker/admin test users.
4. For worker flow: pay weekly premium, activate policy, check monitoring, create claim.
5. For admin flow: review dashboard, open claims review, run simulation scenarios.
6. Verify backend health: http://localhost:5000/api/health

## 11. Troubleshooting Quick Reference

Problem: localhost refused to connect.
- Confirm containers are up: docker compose ps
- Check frontend specifically: service name frontend on port 3001
- Check backend health URL.

Problem: port already allocated.
- Stop conflicting containers/processes using that host port.
- Retry with docker compose down --remove-orphans then up -d.

Problem: nginx or mongo init mount error (directory vs file).
- Required paths are file mounts:
- ./nginx.conf/nginx.conf -> /etc/nginx/nginx.conf
- ./mongo-init.js/mongo-init.js -> /docker-entrypoint-initdb.d/mongo-init.js

## 12. File Map for Core Areas

Core backend entry:
- server.js

API route files:
- routes/auth.js
- routes/workers.js
- routes/policies.js
- routes/claims.js
- routes/monitoring.js
- routes/admin.js
- routes/simulation.js

Core services:
- services/monitoringService.js
- services/claimService.js
- services/riskAssessmentService.js
- services/fraudDetectionService.js
- services/payoutService.js
- services/autonomousEngineService.js

Frontend entry:
- client/src/App.js

Compose and runtime:
- docker-compose.yml
- nginx.conf/nginx.conf
- mongo-init.js/mongo-init.js

---
If you want, this guide can be split next into separate files:
- API_REFERENCE.md
- ADMIN_WORKFLOW.md
- WORKER_WORKFLOW.md
- DEPLOYMENT.md
