# Codebase Intelligence

> AI-powered codebase analysis and developer intelligence platform.

Codebase Intelligence analyzes a GitHub repository and turns its source code into actionable insights about architecture, dependencies, security, code quality, risks, technical debt, and change impact.

## ✨ Features

- **Repository Analysis** — scan a public GitHub repository and build a codebase index.
- **System Architecture** — visualize how scanning, analysis, intelligence, APIs, and the dashboard work together.
- **Dependency Graph** — explore file/module dependencies, relationships, highly connected nodes, and cycles.
- **Impact Analysis** — identify direct and indirect dependents affected by changes to a file.
- **Security Scanner** — detect common security-risk patterns in source code and dependencies.
- **Code Quality** — surface measurable quality and maintainability signals.
- **Risk Register** — organize detected risks by severity and affected files.
- **Technical Debt** — identify files and areas that may require maintenance.
- **Global Code Search** — search source code across the currently analyzed repository.
- **Ask Your Codebase** — query indexed repository information using the platform's analysis data.
- **Source Inspection** — open analyzed files and inspect their source directly from the dashboard.
- **Engineering Intelligence** — inspect Git history, file churn, code hotspots, and architecture drift signals.

## 🏗️ Architecture

```text
GitHub Repository
       ↓
Repository Scanner & Indexer
       ↓
Code Analysis Engine
 ┌─────┼─────────┬──────────┐
 ↓     ↓         ↓          ↓
Security  Quality  Architecture  Risk
 └─────┬─────────┴──────────┘
       ↓
Codebase Intelligence Layer
       ↓
API Server
       ↓
React Intelligence Dashboard
```

## 🧰 Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Wouter
- TanStack Query
- Tailwind CSS / custom design system

### Backend
- Node.js
- Express
- TypeScript
- GitHub repository scanning
- Static source-code analysis

## 📁 Project Structure

```text
Codebase-Intelligence/
├── artifacts/
│   ├── api-server/
│   │   └── src/
│   │       ├── lib/
│   │       └── routes/
│   └── codebase-intelligence/
│       └── src/
│           ├── components/
│           └── pages/
├── package.json
└── README.md
```

## 🚀 Running Locally

Install dependencies:

```bash
pnpm install
```

Build and start the API server:

```bash
cd artifacts/api-server
pnpm run build
pnpm run start
```

For frontend development, run the frontend workspace with the repository's configured development command.

## 🔍 How It Works

1. Enter a public GitHub repository URL.
2. Codebase Intelligence scans the repository without executing its application code.
3. The scanner indexes files, languages, imports, dependencies, and repository signals.
4. Analysis engines calculate architecture, security, quality, risk, and dependency insights.
5. The API exposes the analyzed data to the React dashboard.
6. Developers explore the repository through graphs, search, source inspection, impact analysis, and intelligence views.
7. Engineering Intelligence uses repository history and structural analysis to highlight churn, hotspots, and architecture drift.

## 🔐 Security Scanner Note

A clean result means **no issues were detected by the currently implemented security rules**. It should not be interpreted as a guarantee that the repository is completely secure.

## 🎯 Project Goal

Codebase Intelligence is designed to help developers understand unfamiliar repositories faster, identify risky areas before making changes, and make informed engineering decisions from a single workspace.

## 📌 Status

**Actively maintained and evolving**, with ongoing improvements to code analysis, security detection, dependency intelligence, architecture analysis, and developer insights.
