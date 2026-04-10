# Tasks: Inventory Pricing App

- [x] 1. Project setup
  - Create package.json, tsconfig.json, .env.example
  - Install: express, better-sqlite3, bcrypt, cookie-session
  - Create src/db.ts — opens SQLite, creates items table

- [x] 2. API routes
  - Create src/app.ts with all routes
  - GET /api/items?search= — returns items filtered by name
  - POST /api/admin/login — checks password, sets session
  - POST /api/admin/logout — clears session
  - POST /api/admin/items — create item
  - PUT /api/admin/items/:id — update item
  - DELETE /api/admin/items/:id — delete item
  - Admin middleware that checks session cookie on all /api/admin/* routes

- [x] 3. Associate page (public/index.html)
  - Search bar that filters items as you type
  - Table showing item name and current price
  - No editing controls

- [x] 4. Admin login page (public/admin/index.html)
  - Simple password form
  - On success, redirect to dashboard

- [x] 5. Admin dashboard (public/admin/dashboard.html)
  - List all items with name, price, edit and delete buttons
  - Form to add a new item
  - Inline price/name editing
  - Logout button
