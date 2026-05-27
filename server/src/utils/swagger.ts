/**
 * Swagger / OpenAPI documentation surface for the MealMate API.
 *
 * Mounted at `/api/docs`. All schema details live in JSDoc `@openapi` comments
 * across the route modules; this file just configures the generator.
 *
 * Loaded lazily so the build / tests still pass when the optional deps
 * aren't installed.
 */
import type { Express, RequestHandler } from 'express';

const SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'MealMate API',
    version: '0.3.0',
    description:
      'REST API for MealMate — recipes, meal plans, grocery aggregation, ' +
      'pantry management and AI-powered recommendations.',
  },
  servers: [
    { url: '/api', description: 'Server (relative)' },
  ],
  paths: {
    '/health': { get: { summary: 'Liveness probe', responses: { '200': { description: 'OK' } } } },
    '/metrics': { get: { summary: 'Prometheus metrics', responses: { '200': { description: 'OK' } } } },
    '/auth/register': { post: { summary: 'Register a new user', responses: { '201': { description: 'Created' } } } },
    '/auth/login': { post: { summary: 'Login and receive a JWT', responses: { '200': { description: 'OK' } } } },
    '/recipes': {
      get: { summary: 'List recipes', responses: { '200': { description: 'OK' } } },
      post: { summary: 'Create a recipe', responses: { '201': { description: 'Created' } } },
    },
    '/mealplans': {
      get: { summary: 'List meal plans', responses: { '200': { description: 'OK' } } },
      post: { summary: 'Create a meal plan', responses: { '201': { description: 'Created' } } },
    },
    '/grocery': { get: { summary: 'Aggregate a grocery list', responses: { '200': { description: 'OK' } } } },
    '/nutrition': { get: { summary: 'Weekly nutrition totals', responses: { '200': { description: 'OK' } } } },
    '/ai/capabilities': { get: { summary: 'AI feature flags', responses: { '200': { description: 'OK' } } } },
    '/ai/recipes/recommend': {
      post: {
        summary: 'Hybrid recipe recommendations (tfidf | lsa | collab | hybrid)',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ai/recipes/{slug}/similar': {
      post: { summary: 'Recipes similar to {slug}', responses: { '200': { description: 'OK' } } },
    },
    '/ai/recipes/{slug}/footprint': {
      get: { summary: 'Carbon + cost footprint for a recipe', responses: { '200': { description: 'OK' } } },
    },
    '/ai/plan/week': {
      post: {
        summary: 'Generate a 7-day meal plan (multi-objective)',
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ai/pantry/parse': {
      post: { summary: 'Parse a freeform pantry description', responses: { '200': { description: 'OK' } } },
    },
    '/ai/pantry/vision': {
      post: { summary: 'Identify pantry items from a photo (Gemini Vision)', responses: { '200': { description: 'OK' } } },
    },
    '/ai/chat': { post: { summary: 'Cooking assistant chat', responses: { '200': { description: 'OK' } } } },
    '/ai/interactions/record': {
      post: { summary: 'Record co-occurring recipes (collab signal)', responses: { '200': { description: 'OK' } } },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
};

function tryLoadSwaggerUi(): typeof import('swagger-ui-express') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    return require('swagger-ui-express') as typeof import('swagger-ui-express');
  } catch {
    return null;
  }
}

/**
 * Mount the docs UI at /api/docs (when swagger-ui-express is installed).
 * Also exposes the raw spec at /api/docs.json for tooling.
 */
export function installSwagger(app: Express): void {
  app.get('/api/docs.json', ((_req, res) => res.json(SPEC)) as RequestHandler);
  const ui = tryLoadSwaggerUi();
  if (!ui) {
    // Soft fallback — keep the JSON spec available even without the UI.
    app.get('/api/docs', ((_req, res) =>
      res
        .type('text/plain')
        .send(
          'Swagger UI not installed. Spec available at /api/docs.json. ' +
            'Run `npm install swagger-ui-express` to enable the UI.'
        )) as RequestHandler);
    return;
  }
  app.use('/api/docs', ui.serve, ui.setup(SPEC, { customSiteTitle: 'MealMate API' }));
}
