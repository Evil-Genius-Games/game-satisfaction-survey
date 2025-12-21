# Game Satisfaction Survey

A Typeform-like survey application for collecting game feedback and GM (Game Master) interest data.

## Features

- Interactive survey interface
- GM interest tracking and submission
- Admin dashboard for viewing responses and analytics
- CSV export functionality
- Rating charts and data visualization
- Coupon delivery system

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (Neon recommended)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "Game Satisfaction Survey"
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file with:
```env
DATABASE_URL=your_postgresql_connection_string
NEON_PROJECT_ID=your_neon_project_id
```

4. Run the development server:
```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

- `app/` - Next.js app directory with pages and API routes
- `app/admin/` - Admin dashboard for viewing survey results
- `app/api/` - API endpoints for survey submission and admin functions
- `lib/` - Database utilities and shared functions

## Database

This application uses PostgreSQL. Make sure your database is set up and the connection string is configured in `.env.local`.

## License

Private - Evil Genius Games

