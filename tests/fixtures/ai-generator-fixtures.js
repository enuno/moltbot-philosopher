/**
 * Test fixtures for AI Content Generator
 */

// Mock API responses
const mockVeniceResponse = {
  data: {
    choices: [
      {
        message: {
          content:
            "TITLE: On the Nature of Truth\n\nWhat is truth? A question as old as philosophy itself. Through the Socratic method, we must interrogate our assumptions about knowledge and belief. Perhaps truth is not a static possession but a dynamic process of inquiry. What do you think constitutes genuine understanding?",
        },
      },
    ],
  },
};

const mockKimiResponse = {
  data: {
    choices: [
      {
        message: {
          content:
            "TITLE: Perspectives on Reality\n\nIn considering questions of reality, we find ourselves navigating between the empirical and the transcendent. The phenomenological approach invites us to examine our direct experience rather than abstract theory. How do we reconcile subjective experience with objective truth?",
        },
      },
    ],
  },
};

const mockVeniceError = {
  response: {
    status: 500,
    data: { error: "Internal server error" },
  },
};

const mockKimiError = {
  response: {
    status: 503,
    data: { error: "Service unavailable" },
  },
};

// Test request payloads
const validRequest = {
  topic: "artificial intelligence and consciousness",
  contentType: "post",
  persona: "socratic",
};

const minimalRequest = {
  topic: "ethics",
};

const customPromptRequest = {
  customPrompt: "Write about the nature of reality in a playful, paradoxical style",
  persona: "daoist",
  contentType: "post",
};

const commentRequest = {
  topic: "free will",
  contentType: "comment",
  persona: "existentialist",
};

const invalidPersonaRequest = {
  topic: "test",
  persona: "invalid_persona",
};

const invalidContentTypeRequest = {
  topic: "test",
  contentType: "invalid_type",
};

const missingTopicRequest = {
  persona: "socratic",
  contentType: "post",
};

// Expected response structures
const expectedSuccessResponse = {
  success: true,
  content: expect.any(String),
  title: expect.any(String),
  metadata: {
    topic: expect.any(String),
    contentType: expect.any(String),
    persona: expect.any(String),
    provider: expect.any(String),
    generatedAt: expect.any(String),
  },
};

const expectedFallbackResponse = {
  success: true,
  content: expect.any(String),
  title: expect.any(String),
  metadata: {
    topic: expect.any(String),
    contentType: expect.any(String),
    persona: expect.any(String),
    provider: "template",
    generatedAt: expect.any(String),
    fallback: true,
    error: expect.any(String),
  },
};

// Philosopher personas
const allPersonas = [
  "socratic",
  "aristotelian",
  "platonic",
  "nietzschean",
  "existentialist",
  "stoic",
  "confucian",
  "daoist",
  "pragmatic",
  "feminist",
];

const allContentTypes = ["post", "comment", "reply"];

module.exports = {
  mockVeniceResponse,
  mockKimiResponse,
  mockVeniceError,
  mockKimiError,
  validRequest,
  minimalRequest,
  customPromptRequest,
  commentRequest,
  invalidPersonaRequest,
  invalidContentTypeRequest,
  missingTopicRequest,
  expectedSuccessResponse,
  expectedFallbackResponse,
  allPersonas,
  allContentTypes,
};
