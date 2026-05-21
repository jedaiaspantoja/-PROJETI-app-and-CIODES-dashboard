# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## High-Level Code Architecture and Structure

This project is divided into three main applications:

-   **App do Solicitante/Socorrista (Mobile App)**: Built with Expo SDK 54, React Native, and TypeScript. The main entry point for navigation is `App.tsx`.
    -   `frontend/`: Contains all mobile app screens (Login, Cadastro, Home, ListaCasos, TipoVitima, TutorialCaso, Registro, DetalheRegistro, BombeiroDashboard, BombeiroDetalhe).
    -   `backend/`: Houses connectors and data access utilities, including `connectors/postgre.ts` for Supabase client, and `offline/` for Expo SQLite offline implementation.
-   **Dashboard CIODES (Web Panel)**: A static HTML/CSS/JavaScript application located in `dashboard/`. It interacts directly with Supabase using Realtime subscriptions.
-   **Database**: Managed with Supabase (Postgres and Supabase Auth). SQL scripts for schema and seeding are in `database/`.

The project utilizes Supabase for authentication and data storage, with a focus on real-time updates for the dashboard and offline support for the mobile app using Expo SQLite v2.

## Commonly Used Commands

### Installation

-   **Install Node.js dependencies**:
    ```powershell
    npm install
    ```

### Running Applications

-   **Run the mobile app (Expo)**:
    ```powershell
    npx expo start --lan --port 8085 --clear
    ```
    (If port 8085 is busy, try `--port 8086`)
-   **Run the CIODES Dashboard (static server)**:
    ```powershell
    python -m http.server 8000
    ```
    Access at `http://localhost:8000/dashboard/`

### Validation

-   **Check TypeScript types**:
    ```powershell
    npx --no-install tsc --noEmit
    ```
-   **Check Dashboard JavaScript syntax**:
    ```powershell
    node --check dashboard\app.js
    ```
-   **Test if Dashboard is serving**:
    ```powershell
    Invoke-WebRequest -UseBasicParsing "http://localhost:8000/dashboard/?v=20260506-1" | Select-Object -ExpandProperty StatusCode
    ```

## Development Workflow and Practices

### Git Collaboration Rules

-   **Do not work directly on `main` branch.**
-   **Create a separate branch for each task** (e.g., `git checkout -b feature-name`).
-   **Before starting work, update your `main` branch**:
    ```powershell
    git checkout main
    git pull origin main
    ```
    Then create a new branch from the updated `main`.
-   **Before pushing changes, run TypeScript check**:
    ```powershell
    npx --no-install tsc --noEmit
    ```
-   **Major changes should go through Pull Requests.**
-   **Do not commit sensitive files**: `.env`, database passwords, service role keys, logs (like `expo.log`), or `node_modules`.

### Supabase Configuration

-   Public Supabase keys (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) are exposed in the frontend but rely on **Row Level Security (RLS)** and policies for real security in production.
-   **Sensitive credentials (e.g., `DATABASE_URL`, `DIRECT_URL` with real passwords, service role keys, private tokens)** must be kept out of version control. Use `.env.example` with placeholders for sharing.

### GitHub Repository

-   **Remote Repository**: `https://github.com/jedaiaspantoja/-PROJETI-app-and-CIODES-dashboard.git`
-   **Cloning the Project**:
    ```powershell
    git clone https://github.com/jedaiaspantoja/-PROJETI-app-and-CIODES-dashboard.git
    cd -PROJETI-app-and-CIODES-dashboard
    npm install
    copy .env.example .env
    ```
-   **Saving Changes**:
    ```powershell
    git status
    git add .
    git commit -m "Describe the change made"
    ```
-   **Pushing to GitHub**:
    ```powershell
    git push -u origin your-branch-name
    ```
    Then create a Pull Request on GitHub from `your-branch-name` to `main`.
