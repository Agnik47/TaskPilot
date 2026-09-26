<div align="center">

# ✈️ TaskPilot

**Team work management for small teams and early-stage startups. Free and self-hostable.**

Stop tracking work in spreadsheets, WhatsApp threads, and "hey, is that done yet?"
TaskPilot gives a 5–50 person team one clear place to see who's doing what, what's stuck, and what's finished, without Jira's price tag or learning curve.

[Features](#-features) · [Why TaskPilot](#-why-taskpilot) · [Quick Start](#-quick-start) · [Deploy](#-deploy-for-free) · [Contributing](#-contributing)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-Express_5-339933?logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?logo=postgresql&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

</div>

---

## 💡 Why TaskPilot?

Most early-stage startups hit the same wall. The team grows past 5 people, the spreadsheet stops working, and the options are:

| | Jira / Asana / Monday | Spreadsheets + chat | **TaskPilot** |
|---|---|---|---|
| **Cost** | $8–$25 per user/month, and it grows with every hire | Free | **Free, you host it** |
| **Setup time** | Days of configuring workflows, schemes, and fields | Minutes | **Minutes** |
| **Learning curve** | Needs a "Jira person" | None | **None, built for non-technical staff** |
| **Who owns what** | ✅ | ❌ Lost in chat | ✅ Every task has one owner |
| **Blockers visible** | Via plugins/config | ❌ | ✅ Built in |
| **Approval workflow** | Via config | ❌ | ✅ Built in |
| **Real-time updates** | ✅ | ❌ | ✅ |
| **Your data** | On their servers | Scattered | **In your own Postgres database** |

TaskPilot is **not a Jira clone**. It deliberately does less: no story points, no sprint ceremonies, no 40-field issue forms. It covers the workflows a small team actually uses every day and leaves out the rest.

> **Rough math:** a 15-person team on a typical paid plan pays **$1,500–$4,500 a year**. On TaskPilot's free-tier stack (Vercel + Render + Neon + Clerk), the same team pays **$0**.

---

## ✨ Features

### 🗂️ Projects & Tasks
- **Workspaces** for each company or team, with projects inside each workspace
- **Tasks** with type (Task, Bug, Feature, Improvement), priority (Low → Urgent), status, assignee, and optional due dates
- **Three ways to view tasks:** a **Table**, a drag-and-drop **Kanban Board**, and a spreadsheet-style **Sheet** with inline editing. Owners choose which one projects open in by default.
- **Quick add** and **bulk task creation** for loading a backlog fast
- **Project calendar** for due dates at a glance
- **Checklists** on tasks, where each item can be assigned to a different person

### 👥 Clear Roles: Owner vs. Employee
- **Owners** create projects, assign and reassign work, set priorities, manage members, and see everything in the workspace
- **Employees** see their own work, create tasks for themselves, update what they're responsible for, and comment. They **can't** reassign or edit other people's work.
- Permissions are enforced **on the server**, not just hidden in the UI

### ✅ Review & Approval Workflow
- When an employee marks an assigned task **Done**, it goes to **In Review**
- The owner **approves** it or **requests changes** with a note
- Can be switched off in workspace settings if your team doesn't need it

### 🚧 Blockers ("Waiting On")
- Mark a task as blocked **by a specific person**, so it's clear who needs to act
- A **"Waiting on you"** panel shows each person what others are blocked on
- **Nudge** the person you're waiting on, and get notified when the blocker is resolved

### 🔔 Real-Time Collaboration
- Live task discussions with **@mentions**, typing indicators, and presence
- In-app **notification bell** for assignments, mentions, review requests, approvals, and blockers
- A per-task **activity history** records every status, priority, assignee, and due-date change

### 📊 Owner Visibility (Without Micromanaging)
- **Dashboard** with task totals, completion, **overdue work**, and **team workload**
- **Project analytics** charts
- **My Work** page so each person has a single focused to-do list
- Workspace-wide **recent activity** feed

### 🎨 Polished Experience
- Light and dark mode
- Works on mobile, with card layouts on small screens
- Global search from the navbar

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS 4, Redux Toolkit, React Router 7, dnd-kit, Recharts |
| **Backend** | Node.js, Express 5, Socket.IO |
| **Database** | PostgreSQL via Prisma ORM (tuned for [Neon](https://neon.tech) serverless Postgres) |
| **Auth & Orgs** | [Clerk](https://clerk.com) (users, organizations/workspaces, roles, invitations) |

Every service in the stack has a free tier that comfortably fits a small team.

---

## 📁 Project Structure

```
TaskPilot/
├── Client/                 # React frontend (Vite)
│   └── src/
│       ├── pages/          # Dashboard, My Work, Projects, Team, Settings...
│       ├── components/     # Board, Sheet, Blockers, Review, Settings UI...
│       ├── features/       # Redux slices
│       ├── hooks/          # Task actions, sockets, roles
│       └── lib/            # API client, workflow & date helpers
├── Server/                 # Express API
│   ├── routes/             # REST endpoints under /api/*
│   ├── controllers/
│   ├── services/           # Authorization, workflow, blockers, notifications
│   ├── middleware/         # Auth, org scoping, role checks
│   ├── migrations/         # Prisma migrations
│   ├── schema.prisma
│   └── realtime.js         # Socket.IO layer
└── docs/
    └── requirements.md     # Product requirements
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** and npm
- A **PostgreSQL** database. A free [Neon](https://neon.tech) project is the easiest option.
- A free **[Clerk](https://clerk.com)** application with **Organizations enabled**

### 1. Clone the repository

```bash
git clone https://github.com/Agnik47/TaskPilot.git
cd TaskPilot
```

### 2. Set up Clerk

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Go to **Organizations → Settings** and **enable Organizations**. Each organization becomes a TaskPilot workspace.
3. Copy your **Publishable key** and **Secret key**.

> TaskPilot maps Clerk's `org:admin` role to **Owner** and `org:member` to **Employee**.

### 3. Configure the server

Create `Server/.env`:

```env
NODE_ENV=development
PORT=3000

CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Pooled connection string (used by the app at runtime)
DATABASE_URL=postgresql://user:password@host/db?sslmode=require

# Direct / unpooled connection string (used by Prisma migrations)
DIRECT_URL=postgresql://user:password@host/db?sslmode=require
```

Install dependencies and apply the database migrations:

```bash
cd Server
npm install
npx prisma migrate deploy
npm run server        # starts the API with nodemon on http://localhost:3000
```

### 4. Configure the client

Create `Client/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3000
```

Then in a new terminal:

```bash
cd Client
npm install
npm run dev           # http://localhost:5173
```

### 5. Create your workspace

Sign up, create an organization (your workspace), and invite your team from **Settings → Members**. You're ready to go.

---

## ☁️ Deploy for Free

A setup that costs **$0/month** for a small team:

| Part | Service | Notes |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | Set root to `Client/`. `vercel.json` already handles SPA routing. |
| Backend | [Render](https://render.com) / [Railway](https://railway.app) | Root `Server/`, start command `npm start`. It needs a long-running server for Socket.IO. |
| Database | [Neon](https://neon.tech) | Use the pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_URL`. |
| Auth | [Clerk](https://clerk.com) | The free tier covers a small team. |

Remember to set `VITE_API_URL` on the frontend to your deployed backend URL.

> Free-tier backends on some hosts sleep when idle, so the first request after a quiet period can be slow. A paid instance, or a simple uptime pinger, avoids this.

---

## 🔌 API Overview

All endpoints live under `/api` and require a Clerk session with an active organization.

| Resource | Endpoints |
|---|---|
| Projects | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id`, project members |
| Tasks | `GET/POST /api/tasks`, `POST /api/tasks/bulk`, `GET/PUT/DELETE /api/tasks/:id` |
| Review | `POST /api/tasks/:id/review` *(owner only)* |
| Comments | `GET/POST /api/tasks/:id/comments` |
| Blockers | `POST /api/tasks/:id/blockers`, `.../resolve`, `.../nudge` |
| Checklist | `POST/PATCH/DELETE /api/tasks/:id/checklist[/:itemId]` |
| Other | `/api/dashboard/summary`, `/api/activity`, `/api/members`, `/api/notifications`, `/api/workspace/settings` |

---

## 🗺️ Roadmap

- [ ] Email / Slack notifications
- [ ] Recurring tasks
- [ ] File attachments on tasks
- [ ] CSV import from existing spreadsheets
- [ ] Docker Compose for one-command self-hosting
- [ ] Team leaderboard

Have an idea? [Open an issue](https://github.com/Agnik47/TaskPilot/issues).

---

## 🤝 Contributing

Contributions are welcome, especially from people running small teams who know what they actually need.

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push and open a Pull Request

Please keep TaskPilot's core principle in mind: **simple enough for non-technical teammates.** A feature that adds configuration overhead needs to justify it.

---

## 📜 License

No license has been chosen yet. Until one is added, all rights are reserved by the author. If you'd like to use TaskPilot in your company, please open an issue.

---

<div align="center">

**Built for small teams who'd rather ship than configure a project tracker.**

If TaskPilot saves your team money, consider giving it a ⭐

</div>
