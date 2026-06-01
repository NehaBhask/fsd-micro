# 🚀 API Playground

A cloud-based API testing tool that lets developers send HTTP requests, save collections, track history, manage environment variables, and collaborate via shareable links—all from the browser, no installation needed.

> Built as a cloud-based alternative to Postman with microservices architecture, Docker containerization, dynamic documentation generators, transaction email integrations, and an analytical stats dashboard.

![Status](https://img.shields.io/badge/Status-Live-brightgreen) ![React](https://img.shields.io/badge/React-18-blue) ![Node.js](https://img.shields.io/badge/Node.js-20-green) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green) ![Docker](https://img.shields.io/badge/Docker-Containerized-blue) ![Microservices](https://img.shields.io/badge/Architecture-Microservices-orange)

---

## 🌐 Live Demo

| Service | URL |
|---|---|
| Frontend | https://api-playground-frontend.onrender.com |

---

## ✨ Features

- **Request Builder** — Send GET, POST, PUT, PATCH, DELETE requests with custom headers, params, and JSON body.
- **Response Viewer** — Syntax-highlighted JSON response with status code, response time, and payload size.
- **Collections** — Save and organize requests into named collections, synced to the cloud database.
- **Request History** — Every request auto-saved with method, URL, timestamp, status code, and response time.
- **Environment Variables** — Create environments with `{{VARIABLE}}` substitution in URLs, headers, and body.
- **Share Collections** — Generate a public link to share collections with teammates for read-only viewing.
- **Import Collections** — One-click import of shared collections into your account workspace.
- **Stats Dashboard** — Analytics showing total requests, success rate, method breakdown, and top APIs.
- **User Authentication & Recovery** — Secure user register/login with JWT-based sessions, and a secure password recovery flow via the **Resend** transactional email API.
- **API Documentation Generator** — Generate dynamic, beautifully styled public documentation pages for any collection, with formats supported for **HTML**, **Markdown**, and **OpenAPI 3.0 specification** downloads.
- **Zero-Cache Development Mode** — Integrated cache-busting Nginx headers for instant frontend updates upon rebuilding Docker images.

---

## 🏗️ Architecture

### High Level Diagram

```
┌───────────────────────────────────────────────────┐
│                    USER BROWSER                   │
│         React + TypeScript + Tailwind CSS         │
│         Served by nginx inside Docker             │
│         Deployed on Render (Docker Container)     │
└───────────────────────┬───────────────────────────┘
                        │ HTTPS REST API
┌───────────────────────▼───────────────────────────┐
│               API GATEWAY (nginx)                 │
│         Single entry point — port 3000            │
│         Routes requests to microservices          │
└──────┬───────────┬────────────┬─────────────┬─────┘
       │           │            │             │
       ▼           ▼            ▼             ▼
  auth-service  collection   history     environment
     :3001        :3002        :3003         :3004
       │           │            │             │
       └───────────┼────────────┴─────────────┘
                   ├──────────────────────────┐
                   ▼                          ▼
           [Resend Email API]        ┌────────────────┐
                                     │  MongoDB Atlas │
                                     │ Cloud Database │
                                     └────────────────┘
```

### Microservices Container Network

```
docker-compose up
       ↓
┌──────────────────────────────────────────────────┐
│               app-network (bridge)               │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │          api-gateway (nginx)               │  │
│  │          Port: 3000 (Exposed)              │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────┐   ┌────────────────────────┐   │
│  │auth-service  │   │ collection-service     │   │
│  │Port: 3001    │   │ Port: 3002             │   │
│  └──────────────┘   └────────────────────────┘   │
│                                                  │
│  ┌──────────────┐   ┌────────────────────────┐   │
│  │history-      │   │ environment-service    │   │
│  │service: 3003 │   │ Port: 3004             │   │
│  └──────────────┘   └────────────────────────┘   │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │     api-playground-frontend (nginx)        │  │
│  │     Port: 8080 (Exposed)                   │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### API Gateway Routing

```
/api/auth/*          → auth-service:3001
/api/collections/*   → collection-service:3002
/api/requests/*      → collection-service:3002
/api/history/*       → history-service:3003
/api/environments/*  → environment-service:3004
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand, Axios |
| API Gateway | nginx (reverse proxy) |
| Auth Service | Node.js, Express, TypeScript, JWT, bcryptjs, Resend API |
| Collection Service | Node.js, Express, TypeScript, Mongoose, Doc Builders (HTML/MD/OpenAPI) |
| History Service | Node.js, Express, TypeScript, Mongoose |
| Environment Service | Node.js, Express, TypeScript, Mongoose |
| Database | MongoDB Atlas |
| Containerization | Docker + Docker Compose |
| Frontend Server | nginx (custom zero-cache rule configs) |
| Version Control | Git + GitHub |
| CI/CD | GitHub → Render (auto deploy on push) |

---

## 📁 Project Structure

```
api-playground/
├── frontend/                      # React frontend SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── sidebar/           # Sidebar, ShareModal
│   │   │   ├── request/           # RequestPanel, SaveModal
│   │   │   ├── response/          # ResponsePanel
│   │   │   ├── environment/       # EnvironmentManager
│   │   │   └── Layout.tsx
│   │   ├── pages/
│   │   │   ├── DocsPage.tsx       # Public doc viewer
│   │   │   ├── ImportPage.tsx     # Sharing importer
│   │   │   ├── LoginPage.tsx      # Auth + reset request layout
│   │   │   ├── ResetPasswordPage.tsx # Token password overwriter
│   │   │   └── StatsPage.tsx      # Analytical dashboards
│   │   ├── store/
│   │   │   └── requestStore.ts    # Zustand state store
│   │   └── api/
│   │       ├── client.ts          # Axios base client
│   │       └── sendRequest.ts     # Client HTTP execution
│   ├── Dockerfile                 # Multi-stage node → nginx builder
│   ├── nginx.conf                 # Zero-cache Nginx rules
│   └── package.json
│
├── services/                      # Microservices Directory
│   ├── auth-service/              # Login, register, verify, forgot/reset handlers
│   │   ├── src/server.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── collection-service/        # Collections, requests, public doc engines
│   │   ├── src/server.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── history-service/           # History logging and stats metrics
│   │   ├── src/server.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── environment-service/       # Environment variables
│       ├── src/server.ts
│       ├── Dockerfile
│       └── package.json
│
├── api-gateway/                   # Nginx API Gateway Router
│   ├── nginx.conf                 # Gateway path mapping & CORS preflight rules
│   └── Dockerfile
│
├── backend/                       # Legacy monolithic backend Reference
│
├── docker-compose.yml             # Orchestrates all service containers
├── .env                           # Local environment variables
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Git
- Docker Desktop
- MongoDB Atlas account (free tier)
- Resend API key (optional, for transactional password recovery emails)

---

## Option A — Run with Docker Compose (Recommended) 🐳

This orchestrates the frontend, API gateway, and all 4 backend microservices in Docker.

### 1. Clone the repository

```bash
git clone https://github.com/NehaBhask/api-playground.git
cd api-playground
```

### 2. Create `.env` in the root folder

Create a `.env` file in the root directory:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/apiplayground
JWT_SECRET=your_jwt_secret_here
RESEND_API_KEY=re_your_resend_api_key
FRONTEND_URL=http://localhost:8080
```

### 3. Start Docker Desktop

Ensure the Docker agent/daemon is running on your machine.

### 4. Build and run all containers

To compile the latest source assets and run the services:

```bash
docker compose up --build
```

### 5. Open the Application

Once up, navigate to the services:

| Service | Access URL |
|---|---|
| **Frontend Web App** | http://localhost:8080 |
| **API Gateway Routing** | http://localhost:3000 |

### 6. Health Checks

Gateway maps health checks for validating container health statuses:

```
http://localhost:3000/health   ← API Gateway
http://localhost:3000/api/auth/health   ← Auth Service
http://localhost:3000/api/collections/health   ← Collection Service
http://localhost:3000/api/history/health   ← History Service
http://localhost:3000/api/environments/health   ← Environment Service
```

---

### Useful Docker Commands

```bash
# Run services in background (detached mode)
docker compose up -d

# Stop and tear down all containers and networks
docker compose down

# Purge cache and force rebuild of all container images
docker compose build --no-cache

# Clean build and start containers
docker compose up --build -d

# Inspect live container logs
docker compose logs -f

# Inspect specific container logs
docker compose logs -f auth-service
docker compose logs -f collection-service
```

---

## Option B — Run Local Development (No Docker)

If you prefer starting services natively on your host machine:

### 1. Run Microservices

Open separate terminal windows and run each service:

```bash
# Terminal 1 - Auth Service
cd services/auth-service
npm install
npm run dev   # Runs on port 3001

# Terminal 2 - Collection Service
cd services/collection-service
npm install
npm run dev   # Runs on port 3002

# Terminal 3 - History Service
cd services/history-service
npm install
npm run dev   # Runs on port 3003

# Terminal 4 - Environment Service
cd services/environment-service
npm install
npm run dev   # Runs on port 3004
```

### 2. Start Frontend SPA

```bash
cd frontend
npm install
npm run dev   # Runs on port 5173 (points to local ports directly if bypass gateway)
```

---

## 📊 API Endpoints

All external requests pass through the **Nginx API Gateway on port 3000**.

### Auth Service (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Create account | No |
| `POST` | `/api/auth/login` | Login and retrieve token | No |
| `POST` | `/api/auth/verify` | Internal token validation | No |
| `POST` | `/api/auth/forgot-password` | Requests password reset email link | No |
| `POST` | `/api/auth/reset-password` | Submits tokenized new password | No |

### Collection Service (`/api/collections`, `/api/requests`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/collections` | Get all user collections | Yes |
| `POST` | `/api/collections` | Create user collection | Yes |
| `DELETE`| `/api/collections/:id` | Delete collection | Yes |
| `POST` | `/api/collections/:id/share` | Generate shareable ID | Yes |
| `POST` | `/api/collections/:id/unshare` | Turn off collection sharing | Yes |
| `GET` | `/api/collections/shared/:shareId`| Get public collection JSON | No |
| `POST` | `/api/collections/import/:shareId`| Import collection copy | Yes |
| `POST` | `/api/collections/:id/docs` | Generate documentation assets | Yes |
| `GET` | `/api/collections/docs/:shareId`| Get public collection docs | No |
| `POST` | `/api/requests` | Save a request | Yes |
| `PUT` | `/api/requests/:id` | Update saved request | Yes |
| `DELETE`| `/api/requests/:id` | Delete saved request | Yes |

### History Service (`/api/history`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/history` | Get request history logs | Yes |
| `GET` | `/api/history/stats` | Get aggregated analytic statistics | Yes |
| `POST` | `/api/history` | Log executed request | Yes |
| `DELETE`| `/api/history` | Clear history logs | Yes |
| `DELETE`| `/api/history/:id` | Delete specific history log | Yes |

### Environment Service (`/api/environments`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/environments` | Get all environment scopes | Yes |
| `POST` | `/api/environments` | Create new environment variable list | Yes |
| `PUT` | `/api/environments/:id` | Update environment variable | Yes |
| `DELETE`| `/api/environments/:id` | Remove environment | Yes |

---

## 🔐 Security Standards

- **Secure Password Hashing:** User passwords are encrypted on register/update with `bcryptjs` (using 10 salt rounds).
- **JWT Authentication:** Stateful user session tokens are verified on each gateway route.
- **Service Isolation:** Backend services communicate internally via token validation; database calls are fully scoped to the authenticated user ID.
- **Metadata-only Sharing:** Shared collections do not leak authorization tokens or variable values.
- **Secure Sandbox Reset:** Password recovery link triggers are signed using short-lived tokens (15-minute expiration).

---

## 📄 License

MIT