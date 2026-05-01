# Qatar Admin Portal — Backend (Flask)

## Overview

Backend implementation for the CertifyMe Full Stack Assessment.
This project converts a static admin UI into a fully functional system by adding authentication, database persistence, and opportunity management.

---

## What I Built

### Authentication System

* Admin Sign Up with validation (unique email, password rules)
* Secure Login with session handling
* “Remember Me” session persistence
* Forgot Password with expiring reset link (1 hour)

### Opportunity Management

* Create, View, Edit, Delete opportunities
* Each opportunity linked to logged-in admin
* Data persists across sessions (database-driven)
* No hardcoded data — fully dynamic

### Data Integrity & Security

* Admin-specific data isolation
* Generic login error messages
* Expiring password reset links
* Server-side validation for all inputs

---

## Tech Stack

| Layer     | Technology         |
| --------- | ------------------ |
| Backend   | Python             |
| Framework | Flask              |
| Database  | SQLite             |
| Frontend  | Pre-built Admin UI |

---

## Project Structure

```
qatar-admin-portal-backend/
│
├── backend/
│   ├── app.py
│   ├── auth.py
│   ├── database.py
│   ├── opportunities.py
│   ├── people.py
│   └── notifications.py
│
├── sky/
│   ├── admin.html
│   ├── admin.css
│   └── admin.js
│
├── requirements.txt
├── .env.example
└── README.md
```

---

## System Flow

```
Admin (UI)
   ↓
Frontend (admin.html)
   ↓
API Requests
   ↓
Flask Backend
   ↓
Database (SQLite)
   ↓
Response → UI updates
```

---

## Setup Instructions

### 1. Clone Repository

```
git clone https://github.com/imthiyaz-syed/qatar-admin-portal-backend.git
cd qatar-admin-portal-backend
```

### 2. Create Virtual Environment

```
python -m venv venv
venv\Scripts\activate   # Windows
```

### 3. Install Dependencies

```
pip install -r requirements.txt
```

### 4. Run Application

```
python backend/app.py
```

---

## API Endpoints (Core)

| Method | Endpoint            | Description             |
| ------ | ------------------- | ----------------------- |
| POST   | /signup             | Create admin account    |
| POST   | /login              | Authenticate admin      |
| POST   | /forgot-password    | Generate reset link     |
| GET    | /opportunities      | Fetch all opportunities |
| POST   | /opportunities      | Create new opportunity  |
| PUT    | /opportunities/<id> | Update opportunity      |
| DELETE | /opportunities/<id> | Delete opportunity      |

---

## Key Design Decisions

* Modular backend structure (auth, opportunities, database separation)
* Database-driven state (no frontend storage)
* Secure authentication flow with generic error handling
* Immediate UI updates via API integration

---

## Assumptions

* Email service not implemented (reset links logged internally)
* UI remains unchanged as per requirement
* SQLite used for simplicity

---

## Limitations

* No JWT authentication (session-based only)
* No production deployment setup
* Minimal automated testing

---

## Future Improvements

* Add JWT-based authentication
* Integrate email service for password reset
* Replace SQLite with PostgreSQL
* Add unit & integration tests
* Dockerize application

---

## Outcome

The backend successfully transforms the static UI into a dynamic, production-style system with:

* Secure authentication
* Persistent data storage
* Full CRUD functionality
* Clean modular architecture

---
