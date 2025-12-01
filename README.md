# ADN Cleaning Services - Billing System Frontend

A modern, responsive billing management system built with Next.js and Tailwind CSS.

## Features

- **Role-based Authentication** (Admin, Driver, Client)
- **Admin Panel**: Client management, invoice creation, payment tracking
- **Driver Panel**: View invoices, record payments, cash closure reports
- **Client Portal**: Profile and beneficiary management
- **Responsive Design**: Works on all devices
- **Modern UI**: Clean interface with Tailwind CSS

## Prerequisites

- Node.js 18+ 
- Your separate API backend running
- Modern web browser

## Installation

1. **Clone or download the project**

2. **Install dependencies:**
\`\`\`bash
npm install
\`\`\`

3. **Configure API endpoint:**
   - Update the API URL in `contexts/AuthContext.tsx` and other components
   - Replace `https://api.adncleaningservices.co.uk/v1/api//` with your actual API URL

4. **Run the development server:**
\`\`\`bash
npm run dev
\`\`\`

5. **Open your browser:**
   - Navigate to `http://localhost:3000`

## API Integration

This frontend connects to your separate API backend. Make sure your API is running and accessible.

### Required API Endpoints:

- `POST /auth/login` - User authentication
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile
- `GET /clients` - Get clients (admin only)
- `POST /clients` - Create client (admin only)
- `GET /invoices` - Get invoices
- `POST /invoices` - Create invoice (admin only)
- `GET /payments/driver/:driverId` - Get driver payments
- `POST /payments` - Record payment (driver)
- `GET /cash-closures/driver/:driverId` - Get cash closures
- `POST /cash-closures` - Create cash closure (driver)

## Environment Setup

No environment variables needed for the frontend. Just ensure your API backend is running and update the API URLs in the code.

## Demo Accounts

The system expects these demo accounts to be created in your API:

- **Admin**: username: `admin`, password: `admin123`
- **Driver**: username: `driver`, password: `driver123`  
- **Client**: username: `client`, password: `client123`

## Project Structure

\`\`\`
├── app/                    # Next.js app directory
│   ├── admin/             # Admin panel pages
│   ├── driver/            # Driver panel pages
│   ├── client/            # Client portal pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home/login page
│   └── globals.css        # Global styles
├── components/            # Reusable components
│   ├── LoginForm.tsx      # Login form component
│   ├── Sidebar.tsx        # Navigation sidebar
│   ├── Modal.tsx          # Modal component
│   ├── Table.tsx          # Data table component
│   └── LoadingSpinner.tsx # Loading indicator
├── contexts/              # React contexts
│   ├── AuthContext.tsx    # Authentication context
│   └── ToastContext.tsx   # Toast notifications
└── public/               # Static assets
\`\`\`

## Building for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Technologies Used

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **React Context** - State management

## Support

For issues related to the frontend, check the browser console for errors and ensure your API backend is running and accessible.
