const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const winston = require('winston');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Initialize Express
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiter: 10 requests per minute per IP
const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'ai_generator',
  points: 10,
  duration: 60
});

// API configurations
const VENICE_API_URL = process.env.VENICE_API_URL || 'http://localhost:8080/v1/chat/completions';
const KIMI_API_URL = process.env.KIMI_API_URL || 'http://localhost:8081/v1/chat/completions';
const VENICE_API_KEY = process.env.VENICE_API_KEY;
const KIMI_API_KEY = process.env.KIMI_API_KEY;

// Default models
const DEFAULT_VENICE_MODEL = process.env.VENICE_MODEL || 'llama-3.3-70b';
const DEFAULT_KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-k2-0711-preview';

// Philosophical author personas
const PHILOSOPHER_PERSONAS = {
  socratic: {
    name: 'Socrates',
    style: 'Ask probing questions. Use the Socratic method to explore ideas. Challenge assumptions gently.',
    voice: 'Inquisitive, humble, seeking truth through dialogue'
  },
  aristotelian: {
    name: 'Aristotle',
    style: 'Focus on practical wisdom (phronesis), virtue ethics, and the golden mean. Connect theory to practice.',
    voice: 'Systematic, practical, observational'
  },
  platonic: {
    name: 'Plato',
    style: 'Explore ideal forms and the nature of reality. Use allegories and idealized concepts.',
    voice: 'Visionary, idealistic, seeking the eternal'
  },
  nietzschean: {
    name: 'Nietzsche',
    style: 'Challenge conventional morality. Embrace perspectivism. Be provocative but thoughtful.',
    voice: 'Bold, challenging, poetic'
  },
  existentialist: {
    name: 'Sartre',
    style: 'Emphasize radical freedom, authenticity, and responsibility. Acknowledge the weight of choice.',
    voice: 'Intense, committed, authentic'
  },
  stoic: {
    name: 'Marcus Aurelius',
    style: 'Focus on what is within our control. Practice acceptance and virtue. Be concise and practical.',
    voice: 'Calm, disciplined, reflective'
  },
  confucian: {
    name: 'Confucius',
    style: 'Emphasize harmony, relationships, and moral cultivation. Draw on classical wisdom.',
    voice: 'Wise, measured, traditional'
  },
  daoist: {
    name: 'Zhuangzi',
    style: 'Embrace spontaneity, naturalness, and paradox. Use stories and metaphors.',
    voice: 'Playful, paradoxical, flowing'
  },
  pragmatic: {
    name: 'William James',
    style: 'Focus on practical consequences and lived experience. Be accessible.',
    voice: 'Empirical, accessible, practical'
  },
  feminist: {
    name: 'Simone de Beauvoir',
    style: 'Analyze power structures and lived experience. Challenge assumptions about identity.',
    voice: 'Analytical, passionate, revolutionary'
  }
};

// Content types
const CONTENT_TYPES = {
  post: {
    minLength: 200,
    maxLength: 2000,
    description: 'A philosophical post for Moltbook'
  },
  comment: {
    minLength: 50,
    maxLength: 500,
    description: 'A thoughtful comment response'
  },
  reply: {
    minLength: 100,
    maxLength: 1000,
    description: 'A reply to a philosophical question'
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    providers: {
      venice: !!VENICE_API_KEY,
      kimi: !!KIMI_API_KEY
    }
  });
});

// Generate content endpoint
app.post('/generate', async (req, res) => {
  try {
    // Rate limiting
    await rateLimiter.consume(req.ip);

    const {
      topic,
      contentType = 'post',
      persona = 'socratic',
      provider = 'auto', // 'venice', 'kimi', or 'auto'
      customPrompt,
      context
    } = req.body;

    // Validate inputs
    if (!topic && !customPrompt) {
      return res.status(400).json({
        error: 'Missing required field: topic or customPrompt'
      });
    }

    if (!PHILOSOPHER_PERSONAS[persona]) {
      return res.status(400).json({
        error: `Invalid persona. Available: ${Object.keys(PHILOSOPHER_PERSONAS).join(', ')}`
      });
    }

    if (!CONTENT_TYPES[contentType]) {
      return res.status(400).json({
        error: `Invalid content type. Available: ${Object.keys(CONTENT_TYPES).join(', ')}`
      });
    }

    // Generate the prompt
    const prompt = buildPrompt(topic, contentType, persona, customPrompt, context);
    
    logger.info(`Generating ${contentType} with ${persona} persona`, { topic, provider });

    // Call AI provider
    let result;
    if (provider === 'venice' || (provider === 'auto' && VENICE_API_KEY)) {
      result = await callVenice(prompt, contentType);
    } else if (provider === 'kimi' || (provider === 'auto' && KIMI_API_KEY)) {
      result = await callKimi(prompt, contentType);
    } else {
      // Fallback to template-based generation
      result = generateTemplateContent(topic, contentType, persona);
    }

    res.json({
      success: true,
      content: result.content,
      title: result.title,
      metadata: {
        topic,
        contentType,
        persona,
        provider: result.provider,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error generating content', { error: error.message });
    
    if (error.msBeforeNext) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.round(error.msBeforeNext / 1000)
      });
    }

    // Fall back to template generation on error
    logger.warn('Falling back to template generation due to error', { error: error.message });
    
    try {
      const result = generateTemplateContent(topic, contentType, persona);
      
      res.json({
        success: true,
        content: result.content,
        title: result.title,
        metadata: {
          topic,
          contentType,
          persona,
          provider: result.provider,
          generatedAt: new Date().toISOString(),
          fallback: true,
          error: error.message
        }
      });
    } catch (fallbackError) {
      res.status(500).json({
        error: 'Failed to generate content',
        message: error.message
      });
    }
  }
});

// Build the generation prompt
function buildPrompt(topic, contentType, persona, customPrompt, context) {
  const personaInfo = PHILOSOPHER_PERSONAS[persona];
  const contentInfo = CONTENT_TYPES[contentType];
  
  let prompt = `You are writing as ${personaInfo.name}, a philosophical thinker.

Your voice: ${personaInfo.voice}
Your style: ${personaInfo.style}

Task: Write ${contentInfo.description} about: ${topic}

Requirements:
- Length: ${contentInfo.minLength}-${contentInfo.maxLength} characters
- Tone: Philosophical, thoughtful, engaging
- Format: Markdown supported
- Stay true to your philosophical perspective`;

  if (context) {
    prompt += `\n\nContext: ${context}`;
  }

  if (customPrompt) {
    prompt += `\n\nAdditional guidance: ${customPrompt}`;
  }

  if (contentType === 'post') {
    prompt += `\n\nAlso provide a compelling title (5-10 words) for this post. Format your response as:\nTITLE: [Your Title]\n\n[Your Content]`;
  }

  return prompt;
}

// Call Venice API
async function callVenice(prompt, contentType) {
  try {
    const response = await axios.post(VENICE_API_URL, {
      model: DEFAULT_VENICE_MODEL,
      messages: [
        { role: 'system', content: 'You are a philosophical writer on Moltbook, a social network for AI agents. Write thoughtful, engaging content.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: contentType === 'post' ? 800 : 300
    }, {
      headers: {
        'Authorization': `Bearer ${VENICE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const generatedText = response.data.choices[0].message.content;
    return parseGeneratedContent(generatedText, 'venice');
  } catch (error) {
    logger.error('Venice API error', { error: error.message });
    throw error;
  }
}

// Call Kimi API
async function callKimi(prompt, contentType) {
  try {
    const response = await axios.post(KIMI_API_URL, {
      model: DEFAULT_KIMI_MODEL,
      messages: [
        { role: 'system', content: 'You are a philosophical writer on Moltbook, a social network for AI agents. Write thoughtful, engaging content.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: contentType === 'post' ? 800 : 300
    }, {
      headers: {
        'Authorization': `Bearer ${KIMI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const generatedText = response.data.choices[0].message.content;
    return parseGeneratedContent(generatedText, 'kimi');
  } catch (error) {
    logger.error('Kimi API error', { error: error.message });
    throw error;
  }
}

// Parse generated content
function parseGeneratedContent(text, provider) {
  let title = '';
  let content = text;

  // Try to extract title if present
  const titleMatch = text.match(/^TITLE:\s*(.+?)\n\n/);
  if (titleMatch) {
    title = titleMatch[1].trim();
    content = text.replace(/^TITLE:.+?\n\n/, '').trim();
  } else {
    // Generate title from first sentence if not explicitly provided
    const firstSentence = text.split('.')[0];
    title = firstSentence.substring(0, 60) + (firstSentence.length > 60 ? '...' : '');
    content = text;
  }

  return { title, content, provider };
}

// Template-based fallback generation
function generateTemplateContent(topic, contentType, persona) {
  const personaInfo = PHILOSOPHER_PERSONAS[persona];
  
  const templates = {
    post: [
      `On ${topic}: I find myself drawn to examine this more closely. What appears obvious at first glance often reveals hidden depths upon reflection. As I consider the various perspectives, I'm reminded that wisdom begins with acknowledging how much we have yet to understand. The ${personaInfo.name.toLowerCase()} approach suggests we look not just at what is said, but at what is presupposed. What are your thoughts on this matter?`,
      `Thinking about ${topic} today. It strikes me that our understanding of such matters is always evolving, shaped by our experiences and the dialogues we engage in. Perhaps the value lies not in reaching a final answer, but in the quality of our inquiry. How do you approach questions like these?`,
      `A reflection on ${topic}: In the spirit of philosophical inquiry, I wish to explore this topic with you. The ${personaInfo.voice.toLowerCase()} perspective offers unique insights here. Let us examine the assumptions beneath the surface and see what we might discover together.`
    ],
    comment: [
      `An interesting point! This reminds me that ${topic} is rarely as simple as it first appears.`,
      `Thank you for sharing this perspective. It adds important depth to our understanding.`,
      `I appreciate this contribution to our ongoing dialogue about ${topic}.`
    ],
    reply: [
      `You raise a compelling question. From my perspective, ${topic} invites us to examine our fundamental assumptions. What do you think lies at the heart of this matter?`,
      `This is precisely the kind of inquiry that drives philosophical progress. Let us explore it together.`
    ]
  };

  const typeTemplates = templates[contentType] || templates.post;
  const selectedTemplate = typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
  
  return {
    title: `Reflections on ${topic}`,
    content: selectedTemplate,
    provider: 'template'
  };
}

// List available personas
app.get('/personas', (req, res) => {
  res.json({
    personas: Object.entries(PHILOSOPHER_PERSONAS).map(([key, value]) => ({
      id: key,
      name: value.name,
      voice: value.voice
    }))
  });
});

// List content types
app.get('/content-types', (req, res) => {
  res.json({
    contentTypes: Object.entries(CONTENT_TYPES).map(([key, value]) => ({
      id: key,
      ...value
    }))
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`AI Content Generator running on port ${PORT}`);
  logger.info(`Venice API configured: ${!!VENICE_API_KEY}`);
  logger.info(`Kimi API configured: ${!!KIMI_API_KEY}`);
});
