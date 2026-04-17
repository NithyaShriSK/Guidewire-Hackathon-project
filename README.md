# GigShield Docker Setup For A New System

This guide is the recommended way to run the project on a fresh machine with minimum setup issues.

No local Node.js, MongoDB, Redis, or Python installation is required when using Docker.

## 1. Prerequisites

Install the following first:

- Git
- Docker Desktop

Verify installation:

```bash
git --version
docker --version
docker compose version
```

If all commands return versions, continue.

## 2. Clone The Project

```bash
git clone <your-repository-url>
cd "Guidewire hackathon"
```

## 3. Create The Environment File

Copy .env.example to .env.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Important:

- Keep UPI_FAKE_MODE=true for demo payouts.
- For full live weather, pollution, and traffic features, use valid API keys in .env.

## 4. Start Docker Desktop

Make sure Docker Desktop is fully started before running compose commands.

## 5. Start The Stack (Recommended No-Error Command)

Start only core services first (recommended for new systems):

```bash
docker compose up -d --build mongodb redis backend frontend
```

Why this command:

- Starts everything needed for app features.
- Avoids optional reverse-proxy startup issues on machines without SSL setup.

Optional: start full stack including nginx

```bash
docker compose up -d --build
```

## 6. Verify Containers Are Healthy

```bash
docker compose ps
```

Expected running services:

- gigshield-mongodb
- gigshield-redis
- gigshield-backend
- gigshield-frontend

## 7. Open The Application

- Frontend: http://localhost:3001
- Backend health endpoint: http://localhost:5000/api/health

## 8. First-Time Feature Validation Checklist

Use this quick checklist to confirm major features are running:

1. Register a Worker account.
2. Register an Admin account.
3. Worker pays weekly premium (demo mode works with UPI_FAKE_MODE=true).
4. Worker dashboard shows active weekly coverage and earnings protected metrics.
5. Admin dashboard shows:
	- loss ratio
	- predicted next-week claims
	- likely next-week weather/disruption claim mix chart
6. Admin fraud simulation runs and returns model score, risk level, and explanation.

## 9. Useful Commands

View service logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Restart specific service:

```bash
docker compose restart backend
docker compose restart frontend
```

Stop all services:

```bash
docker compose down
```

Clean reset (containers + volumes):

```bash
docker compose down -v
docker compose up -d --build mongodb redis backend frontend
```

## 10. Ports Used

- 3001: frontend
- 5000: backend API
- 27017: MongoDB
- 6379: Redis
- 80 and 443: nginx (only when full stack is started)

## 11. Troubleshooting (Most Common)

Docker command not found:

- Restart Docker Desktop.
- Reopen terminal and run docker --version again.

Port already in use:

- Stop conflicting apps on 3001, 5000, 27017, 6379.
- Then restart compose.

Frontend opens but API calls fail:

- Check backend logs: docker compose logs -f backend
- Verify health endpoint: http://localhost:5000/api/health

Monitoring and environmental triggers not working:

- Ensure WEATHER_API_KEY, POLLUTION_API_KEY, TRAFFIC_API_KEY are valid in .env.
- Rebuild backend after updating env:

```bash
docker compose up -d --build backend
```

Fraud model command runs locally but fails in host Python:

- Prefer running app features via Docker backend.
- If host Python is used, install compatible sklearn/pandas/joblib versions.

## 12. One-Line Quick Start

```bash
git clone <your-repository-url> && cd "Guidewire hackathon" && cp .env.example .env && docker compose up -d --build mongodb redis backend frontend
```
