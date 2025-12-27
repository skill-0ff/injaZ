# 💎 Injaz - Task & Team Management System

Injaz is a premium, full-stack task management application designed for teams. It features a modern, **glassmorphism-inspired UI** and a robust role-based backend to manage tasks, groups, and performance metrics effectively.

---

## 🚀 Features

### 🔐 Multi-Tier Access Control
*   **👨‍🏫 Teacher (Admin)**: Full control over users, groups, and tasks.
*   **🏽 Leader**: Manage assigned group tasks and update statuses.
*   **👤 Cell (Member)**: View assigned tasks and personal/group stats.

### 📋 Comprehensive Task Management
*   Full lifecycle management: `Not Started`, `In Progress`, `Completed`, `Failed`.
*   Custom criticality levels for prioritization.

### 📈 Team Performance tracking
*   Automatic scoring systems.
*   Real-time stat tracking for groups and individuals.

### 🛡️ Security First
*   **🔑 JWT-based Authentication**: Secure session management.
*   **🚦 Anti-Brute Force**: Login rate limiting and IP blocking.
*   **🔒 Salted Hashing**: Secure password storage via Bcrypt.
*   **🧼 Clean Data**: Rigorous input validation and sanitization.

### 🎨 Modern UI/UX
*   **💎 Premium Glassmorphism**: High-end design aesthetic.
*   **✨ Dynamic Shaders**: Interactive and animated backgrounds.
*   **📱 Fully Responsive**: Optimized for all device sizes.

---

## 🛠️ Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)

---

## 📋 Prerequisites

*   **Node.js** 🟢 (v14 or higher recommended)
*   **npm** 📦 (Node Package Manager)

---

## ⚡ Installation & Setup

Follow these steps to get the project running locally.

### 1️⃣ Clone the Repository
```bash
git clone <repository-url>
cd injaZ
```

### 2️⃣ Install Backend Dependencies
Navigate to the backend directory and install the required packages.
```bash
cd backend
npm install
```

### 3️⃣ Configure Environment
Copy the example environment file to create your local configuration.
```bash
cp .env.example .env
```
> [!NOTE]
> The default configuration works for most local setups. Ensure `DB_PATH` points to your SQLite database if you customize it.

### 4️⃣ Start the Server
Start the backend server.
```bash
npm start
```
*The server will automatically initialize the database and create a default admin user.*

### 5️⃣ Access the Application
Open your browser and navigate to:
🔗 [http://localhost:3000](http://localhost:3000)

#### 🔑 Admin Credentials
| Role | Email | Password |
| :--- | :--- | :--- |
| **Teacher** | `teacher@test.com` | `password123` |

---

## 📂 Project Structure

```text
injaZ2.0/
├── 📂 backend/           # Node.js Express Server
│   ├── 🗄️ database/      # SQLite database engine
│   ├── 🔐 certs/         # SSL Certificates
│   ├── 🚀 server.js      # Main Entry Point
│   ├── 📦 package.json   # Dependencies
│   └── ⚙️ .env           # Configuration
└── 📂 frontend/          # Client-side Assets
    ├── 📄 index.html     # Login Page
    ├── 📄 teacher.html   # Admin Dashboard
    ├── 📄 leader.html    # Leader Dashboard
    ├── 📄 cell.html      # Member Dashboard
    ├── 🎨 style.css      # Design System
    └── ⚙️ script.js      # Frontend Logic
```

---

## 🛡️ Security Notes

*   **HTTPS**: The application uses a self-signed certificate configuration in `server.js`. For production, ensure valid certificates are used.
*   **User Onboarding**: New users created by the Admin are assigned a default password (`password123`). It is **highly recommended** that users change their password immediately upon their first login.

---

## 🤝 Contributing

1.  **Fork** the repository 🍴
2.  Create your **feature branch** (`git checkout -b feature/AmazingFeature`) 🌿
3.  **Commit** your changes (`git commit -m 'Add some AmazingFeature'`) ✨
4.  **Push** to the branch (`git push origin feature/AmazingFeature`) 🚀
5.  Open a **Pull Request** ⤴️
