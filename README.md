# mini-jira-aws
# Mini-Jira AWS

A lightweight team task-management web application — think stripped-down Jira — fully deployed on AWS. Built as a university cloud computing project demonstrating high-availability architecture, event-driven services, serverless image processing, and real-time notifications.

**Live URL:** https://d2vr2y126cbfkf.cloudfront.net

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [AWS Services](#aws-services)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Demo Scenario](#demo-scenario)
- [Deployment](#deployment)
- [Team](#team)

---

## Overview

Mini-Jira supports multiple teams inside a company. A manager assigns tasks to employees on specific teams; each team only sees its own work. The system enforces team isolation server-side using DynamoDB Global Secondary Indexes — an employee cannot fetch another team's task even by guessing its ID.

### Roles

| Role | Capabilities |
|---|---|
| **Manager** | Create projects & tasks, assign to any employee on any team, view all tasks, filter by team |
| **Employee** | View and update tasks assigned to their own team only, add comments, attach files |
| **Admin** *(merged with Manager)* | Create teams, add users to teams |

### Task lifecycle

`To Do` → `In Progress` → `In Review` → `Done`

---

## Architecture

The application is deployed across two Availability Zones (`us-east-1a`, `us-east-1b`) for high availability:

```
Internet
    ↓
CloudFront (d2vr2y126cbfkf.cloudfront.net)
    ↓
Application Load Balancer (mini-jira-alb)
    ↓               ↓
[Public AZ1]   [Public AZ2]
    ↓               ↓
[Private AZ1]  [Private AZ2]
 EC2 t3.micro   EC2 t3.micro
 (Node.js)      (Node.js)
    ↓
NAT Gateway → Internet
    ↓
┌────────────────────────────────────────────┐
│  AWS Managed Services                      │
│                                            │
│  Cognito         — Auth & JWT              │
│  DynamoDB        — 5 tables + 2 GSIs       │
│  S3 originals    → Lambda resize           │
│                  → S3 resized              │
│  SNS             → Email (assignee)        │
│                  → SQS → Lambda worker     │
│                           → DynamoDB log   │
│                           → CW metrics     │
│  EventBridge     → Lambda daily digest     │
│                  → SNS → Email             │
│  CloudWatch      — Dashboard + Alarms      │
│  IAM             — Least-privilege roles   │
└────────────────────────────────────────────┘
```

---

## Tech Stack

- **Frontend:** React + Vite, Tailwind CSS, shadcn/ui, react-beautiful-dnd (Kanban drag-and-drop)
- **Backend:** Node.js + Express, AWS SDK for JavaScript v3
- **Auth:** AWS Cognito (JWT tokens validated on every request)
- **Database:** DynamoDB (no SQL, fully serverless)
- **Storage:** S3
- **Compute:** EC2 t3.micro (×2), AWS Lambda (×3)
- **Messaging:** SNS + SQS
- **Scheduling:** EventBridge
- **Monitoring:** CloudWatch
- **CDN:** CloudFront
- **Load balancing:** Application Load Balancer + Auto Scaling Group

---

## Features

### Core CRUD
- **Tasks** — create, read, update, delete; title, description, priority, deadline, assignee, team, optional image
- **Projects** — create, read, update, delete
- **Comments** — create and read on each task
- **Images** — upload, replace (old versions retained in S3), delete with task

### Role-based access
- Server-side team filtering via DynamoDB GSI on `teamId`
- Manager bypasses team filter and sees everything
- Cognito user attributes store `role` and `teamId`

### Event-driven notifications
- Task assignment publishes to SNS → fan-out to email + SQS worker
- SQS worker writes activity log to DynamoDB and publishes `TasksAssignedPerTeam` metric to CloudWatch
- EventBridge triggers a daily digest Lambda at 9:00 AM that emails each assignee their tasks due that day

### Image pipeline
- Uploaded images stored in `mini-jira-originals-lusgad`
- S3 PUT event triggers Lambda image resize → thumbnails written to `mini-jira-resized-lusgad`

### Monitoring
- CloudWatch dashboard: tasks created per day, tasks closed per day per team, average time-to-close, EC2 CPU utilization
- CloudWatch alarm: overdue tasks exceeding threshold → SNS alert

### UI
- Kanban board (To Do / In Progress / In Review / Done) with drag-and-drop
- Task detail modal with comments thread
- Loading and empty states, error toasts
- Fully responsive

---

## AWS Services

| Service | Resource name / ID |
|---|---|
| CloudFront | `mini-jira-cdn` · `E2THT3TU2PFT8N` |
| ALB | `mini-jira-alb` · `sg-0b4a67c1af38da5bf` |
| EC2 Instance 1 | `i-04e4665c42f17b733` (us-east-1b) |
| EC2 Instance 2 | `i-014ce6085575cefbe` (us-east-1a) |
| Auto Scaling Group | `mini-jira-asg` |
| Cognito User Pool | `us-east-1_s0QCWUGyo` |
| DynamoDB — Users | `mini-jira-users` |
| DynamoDB — Teams | `mini-jira-teams` |
| DynamoDB — Projects | `mini-jira-projects` |
| DynamoDB — Tasks | `mini-jira-tasks` |
| DynamoDB — Comments | `mini-jira-comments` |
| S3 Originals | `mini-jira-originals-lusgad` |
| S3 Resized | `mini-jira-resized-lusgad` |
| SNS Topic | `mini-jira-task-assignments` |
| SQS Queue | `mini-jira-assignments-queue` |
| VPC | `vpc-0c81e967cb27aefdb` |
| Region | `us-east-1` |

### IAM Roles

| Role | Used by |
|---|---|
| `mini-jira-ec2-role` | EC2 instances |
| `mini-jira-lambda-image-role` | Image resize Lambda |
| `mini-jira-lambda-worker-role` | Assignment worker Lambda |
| `mini-jira-lambda-digest-role` | Daily digest Lambda |

---

## Project Structure

```
mini-jira-aws/
├── backend/              # Express API server
│   ├── routes/           # /api/tasks, /api/projects, /api/teams, /api/comments, /api/auth, /api/upload
│   ├── middleware/        # Cognito JWT validation
│   └── services/         # DynamoDB, S3, SNS clients (AWS SDK v3)
├── frontend/             # React + Vite app
│   ├── components/       # KanbanBoard, TaskModal, CommentThread, etc.
│   └── pages/            # Dashboard, Projects, Login
├── lambdas/
│   ├── image-resize/     # Triggered by S3 PUT on originals bucket
│   ├── assignment-worker/ # Drains SQS, writes activity log, CW metric
│   └── daily-digest/     # EventBridge 9 AM rule → digest email via SNS
├── infrastructure/       # AWS resource configs / notes
└── README.md
```

---

## Environment Variables

Create a `.env` file in `backend/`:

```env
COGNITO_USER_POOL_ID=us-east-1_s0QCWUGyo
COGNITO_CLIENT_ID=7n6p46llv71sg74fefggeig90v
COGNITO_REGION=us-east-1

DYNAMODB_USERS_TABLE=mini-jira-users
DYNAMODB_TEAMS_TABLE=mini-jira-teams
DYNAMODB_PROJECTS_TABLE=mini-jira-projects
DYNAMODB_TASKS_TABLE=mini-jira-tasks
DYNAMODB_COMMENTS_TABLE=mini-jira-comments

S3_ORIGINALS_BUCKET=mini-jira-originals-lusgad
S3_RESIZED_BUCKET=mini-jira-resized-lusgad

SNS_TOPIC_ARN=arn:aws:sns:us-east-1:677896131350:mini-jira-task-assignments
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/677896131350/mini-jira-assignments-queue

CLOUDFRONT_URL=https://d2vr2y126cbfkf.cloudfront.net
AWS_REGION=us-east-1
PORT=3000
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- AWS CLI configured with appropriate credentials
- Access to the AWS account (`677896131350`)

### Run locally

```bash
# Clone
git clone https://github.com/lusgad/mini-jira-aws.git
cd mini-jira-aws

# Backend
cd backend
npm install
cp .env.example .env   # fill in values above
npm run dev

# Frontend (separate terminal)
cd ../frontend
npm install
npm run dev
```

### Update backend on EC2 (via AWS CloudShell)

```bash
aws ssm send-command \
  --instance-ids i-04e4665c42f17b733 i-014ce6085575cefbe \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["cd /home/ec2-user/mini-jira-aws && git pull && npm install && pm2 restart all"]}' \
  --region us-east-1 \
  --query "Command.CommandId" \
  --output text
```

---

## Demo Scenario

The following scenario must work on demo day without code changes:

1. **Manager Ali** logs in → creates **Task A** and assigns it to **Sara** (Frontend team)
2. **Manager Ali** creates **Task B** and assigns it to **Omar** (Backend team)
3. Sara receives an email notification that Task A was assigned to her
4. **Sara** logs in → sees **only Task A** (Frontend team filter enforced server-side)
5. **Omar** logs in → sees **only Task B** (Backend team filter enforced server-side)
6. **Ali** logs back in → sees **both tasks**, can filter by team
7. Sara updates Task A status from `To Do` → `In Progress`
8. Ali can see the status change and the full audit log

---

## Deployment

The app is continuously deployed to two EC2 instances behind the ALB. Use the CloudShell command above to push updates. CloudFront caches static assets; the backend is served at the ALB URL and proxied through CloudFront.

**Backend health check:** `http://mini-jira-alb-703359661.us-east-1.elb.amazonaws.com/health`  
**Frontend (CloudFront):** `https://d2vr2y126cbfkf.cloudfront.net`

---

## Team

Built by the SSSquad team for the AWS Cloud Computing course, May 2026.
