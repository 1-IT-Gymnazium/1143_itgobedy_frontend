# Luncheroo App UI

A modern Vue.js application for managing student lunch information.

## Description

Luncheroo is a lunch management solution designed to help students check their lunch status. The application provides a simple, intuitive interface where users can:

- Log in securely using Google Authentication
- View their lunch status for the day
- Navigate through a clean, responsive user interface

## Tech Stack

- **Frontend Framework**: Vue.js 3 with Composition API
- **Routing**: Vue Router
- **Authentication**: Google OAuth 2.0
- **Building/Bundling**: Vite
- **Styling**: CSS with scoped components

## Features

- **Secure Authentication**: Integration with Google Sign-In
- **Dashboard**: Displays lunch status with clear visual indicators
- **Responsive Design**: Works on both desktop and mobile devices
- **Cookie-Based Auth**: Secure authentication using HTTP-only cookies

## Project Structure

```
src/
├── assets/           # Static assets like images and CSS
├── components/       # Vue components
│   ├── Dashboard.vue # Main dashboard showing lunch status
│   ├── LoginPage.vue # Authentication page with Google Sign-In
├── router/           # Vue Router configuration
└── App.vue           # Root component
```

## Setup Instructions

### Prerequisites

- Node.js (v14+ recommended)
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone [your-repository-url]
   ```

2. Navigate to the project directory:
   ```
   cd luncheroo-app-ui
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Create a `.env` file in the project root with the following variables:
   ```
   VITE_API_URL=http://localhost:5000
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```
   Replace `your-google-client-id` with your actual Google Client ID.

### Running the Application

Development mode:
```
npm run dev
```

Build for production:
```
npm run build
```

## Backend Integration

The frontend expects a backend with the following API endpoints:

- `POST /api/verify-token`: For validating Google authentication tokens
- `GET /api/user-info`: For retrieving user details and lunch status
- `POST /api/logout`: For handling user logout and clearing auth cookies