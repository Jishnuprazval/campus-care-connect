# Campus Care Connect

Build a complete, responsive full-stack web application called Campus Complaint Tracker based on the attached specification. Enable Lovable Cloud for the PostgreSQL database, authentication, and file storage.

Key features to implement:
1. User roles and permissions:
   - Student: create complaints, view own complaints and history, comment/reply, reopen resolved complaints
   - Staff: view assigned complaints, update status, add progress notes/requests for information, mark resolved
   - Admin: view all complaints, assign/reassign to staff, manage categories and roles, view dashboard metrics
   - Enforce server-side permissions and row-level security

2. Complaint workflow and lifecycle:
   - Statuses: Submitted → Assigned → In Progress → Resolved (plus Needs Information, Rejected, Reopened)
   - Chronological status and comment audit history with timestamps and user info
   - Unique tracking numbers, title, description, category, campus building/location, room number, optional photo attachment

3. Core interfaces and dashboards:
   - Authentication (sign up as student by default, role-based sign in)
   - Student dashboard with complaint counts, search, status filters, and submission flow
   - Staff dashboard with assigned workload and processing controls
   - Admin dashboard with system-wide analytics, staff assignment tools, and category management
   - Clean, modern campus service design with clear status indicators, loading/empty states, and mobile responsiveness

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/955ee636-364c-4b27-81a2-7ee44840d9a0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
