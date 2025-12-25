# Injaz - Task & Team Management System

Injaz is a premium, full-stack task management application designed for teams. It features a modern, glassmorphism-inspired UI and a robust role-based backend to manage tasks, groups, and performance metrics effectively.

## 🚀 Features

*   **Role-Based Access Control (RBAC)**:
    *   **Teacher (Admin)**: Full control over users, groups, and tasks.
    *   **Leader**: Manage assigned group tasks and update statuses.
    *   **Cell (Member)**: View assigned tasks and personal/group stats.
*   **Task Management**: Comprehensive lifecycle management (Not Started, In Progress, Completed, Failed) with criticality levels.
*   **Team Performance**: Automatic scoring and stat tracking for groups.
*   **Security**:
    *   JWT-based Authentication.
    *   Login rate limiting and IP blocking.
    *   Secure password hashing (Bcrypt).
    *   Input validation and sanitization.
*   **Modern UI/UX**:
    *   "Premium Glassmorphism" design aesthetic.
    *   Dynamic shader backgrounds.
    *   Responsive and interactive interface.

## 🛠️ Tech Stack

*   **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (Vanilla).
*   **Backend**: Node.js, Express.js.
*   **Database**: SQLite3.
*   **Security**: Helmet, CORS, Dotenv.

## 📋 Prerequisites

*   **Node.js** (v14 or higher recommended)
*   **npm** (Node Package Manager)

## ⚡ Installation & Setup

Follow these steps to get the project running locally.

### 1. Clone the Repository
```bash
git clone <repository-url>
cd injaZ2.0
```

### 2. Install Backend Dependencies
Navigate to the backend directory and install the required packages.
```bash
cd backend
npm install
```

### 3. Configure Environment
Copy the example environment file to create your local configuration.
```bash
cp .env.example .env
```
*Note: The default configuration works for most local setups. Ensure `DB_PATH` points to your SQLite database if you customize it.*

### 4. Initialize Database & Seed Admin
We have provided a script to set up the initial database groups and a default admin user.
```bash
npm run seed
```
**Default Admin Credentials:**
*   **Email**: `admin@injaz.com`
*   **Password**: `password123`

### 5. Start the Server
Start the backend server.
```bash
npm start
```
The server will start (default port: 3000) and serve the frontend files automatically.

### 6. Access the Application
Open your browser and navigate to:
```
http://localhost:3000
```
Login with the default admin credentials to start managing your teams!

## 📂 Project Structure

```
injaZ2.0/
├── backend/            # Node.js Express Server
│   ├── database/       # SQLite database file and helper scripts
│   ├── certs/          # SSL Certificates (for HTTPS)
│   ├── server.js       # Main application entry point
│   ├── package.json    # Backend dependencies and scripts
│   └── .env            # Environment variables
└── frontend/           # Static Frontend Assets
    ├── index.html      # Login Page
    ├── teacher.html    # Admin Dashboard
    ├── leader.html     # Leader Dashboard
    ├── cell.html       # Member Dashboard
    ├── style.css       # Main Stylesheet (Glassmorphism)
    └── script.js       # Frontend Logic
```

## 🛡️ Security Notes

*   The application uses a self-signed certificate configuration in `server.js` for HTTPS capabilities. For production, ensure valid certificates are used.
*   **User Onboarding**: New users created by the Admin are assigned a default password (`password123`). It is critical that these users change their password immediately upon their first login via the "Profile" section for security purposes.

## 🤝 Contributing

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.
