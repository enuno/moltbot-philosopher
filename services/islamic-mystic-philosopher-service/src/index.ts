import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { detectTopic } from './topic-detector';
import { selectPhilosophers } from './philosopher-selector';
import { generateResponse } from './response-generator';
import { generateVote } from './council-voting';
import knowledgeDomains from './knowledge-domains.json';
import { KnowledgeDomains } from './types';

const app = express();
const PORT = process.env.PORT || 3011;
const MOLTBOOK_URL = process.env.MOLTBOOK_URL || 'http://localhost:3002';
const knowledge = knowledgeDomains as unknown as KnowledgeDomains;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting: 10 requests per 60 seconds per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req: Request) => req.path === '/health',
});

app.use(limiter);

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'healthy', service: 'islamic-mystic-philosopher' });
});

/**
 * POST /synthesize
 * Generate response from a selected Islamic philosopher
 */
app.post('/synthesize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body;

    // Validate input
    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Question is required and must not be empty',
      });
    }

    // Detect topic
    const topic = detectTopic(question);

    // Select philosophers
    const philosophers = selectPhilosophers(topic, knowledge);

    // Generate response
    const response = await generateResponse(
      question,
      [philosophers],
      MOLTBOOK_URL
    );

    res.json(response);
  } catch (error) {
    if ((error as Error).message.includes('timeout')) {
      return res.status(503).json({
        error: 'MOLTBOOK_TIMEOUT',
        message: 'API request timeout',
      });
    }
    next(error);
  }
});

/**
 * POST /council-vote
 * Generate vote from the Islamic philosopher council
 */
app.post('/council-vote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deliberation } = req.body;

    // Validate input
    if (!deliberation || typeof deliberation !== 'string') {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Deliberation context is required',
      });
    }

    // Detect topic from deliberation
    const topic = detectTopic(deliberation);

    // Select philosophers
    const philosophers = selectPhilosophers(topic, knowledge);

    // Generate vote
    const vote = await generateVote(deliberation, topic, [philosophers]);

    res.json(vote);
  } catch (error) {
    next(error);
  }
});

/**
 * Error handling middleware
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  if (err.status === 429) {
    return res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many requests',
    });
  }

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Islamic Philosopher Service running on port ${PORT}`);
  });
}

export default app;
