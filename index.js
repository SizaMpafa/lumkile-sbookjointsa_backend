import 'dotenv/config'; // keep this first so .env is loaded before anything reads process.env
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import visitorRoutes from './routes/visitors.js';
import attendanceRoutes from './routes/attendances.js';
import bookRoutes from './routes/books.js';
import loanRequestRoutes from './routes/loan_requests.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct client IPs (rate limiting)

// FRONTEND_URL can be a comma-separated list, e.g. "http://localhost:5173,https://your-app.vercel.app"
const origins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : !isProd }));

app.use(express.json({ limit: '100kb' }));

// Health check: Render pings this, and it's the first thing to test after a deploy.
app.get('/', (req, res) => res.json({ status: 'ok', service: "lumkile's book joint api" }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/loan-requests', loanRequestRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
