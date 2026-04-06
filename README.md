# FixMyPay Docker Run Guide

This guide is only for running the project with Docker.

No local Node.js setup is required for the app itself if you use Docker.

## What They Need To Install First

Before running the project, install:

- Git
- Docker Desktop

Docker Desktop already includes Docker Compose in most setups.

## Check Installation

Open terminal or PowerShell and run:

```bash
git --version
docker --version
docker compose version
```

If all 3 commands return versions, the machine is ready.

## 1. Clone The Repository

```bash
git clone <your-repository-url>
cd "Guidewire hackathon"
```

## 2. Create The Environment File

This project includes a ready-to-use `.env.example` file.

Create `.env` from it.

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### macOS / Linux

```bash
cp .env.example .env
```

## 3. `.env` Is Ready After Copy

Notes:

- After copying, `.env` is ready to use.
- `UPI_FAKE_MODE=true` is recommended for demo use.
- The Docker setup already uses its own MongoDB container, so they do not need to install MongoDB separately.

## 4. Start Docker Desktop

Make sure Docker Desktop is open and fully running before starting the project.

## 5. Run The Project With Docker

Use the development Docker compose file because it starts everything needed:

- MongoDB
- Redis
- Backend
- Frontend

Run:
npm install

then:

```bash
docker compose -f docker-compose.dev.yml up --build
```

The first run may take a few minutes because Docker needs to build the images.

## 6. Open The App

After the containers start, open:

- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:5002`
- Health check: `http://localhost:5002/api/health`

## 7. How To Stop The Project

In the same terminal, press:

```bash
Ctrl + C
```

Then run:

```bash
docker compose -f docker-compose.dev.yml down
```

## 8. If They Want A Fresh Start

To stop and remove containers plus volumes:

```bash
docker compose -f docker-compose.dev.yml down -v
```

Then start again:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## 9. Common Problems

### Docker is not recognized

Install Docker Desktop and restart the machine if needed.

### `docker compose` is not recognized

Update Docker Desktop to a newer version.

### Port already in use

This project uses:

- `3001` for frontend
- `5002` for backend
- `27018` for MongoDB
- `6379` for Redis

Close anything else using those ports, then run Docker again.

### App does not open

Check container logs in the terminal.

You can also run:

```bash
docker compose -f docker-compose.dev.yml ps
```

## 10. Quick Summary

1. Install Git and Docker Desktop
2. Clone the repo
3. Copy `.env.example` to `.env`
4. Start Docker Desktop
5. Run `docker compose -f docker-compose.dev.yml up --build`
6. Open `http://localhost:3001`
