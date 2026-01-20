/**
 * STEM Router - API Endpoints for STEM Integration
 *
 * Integrates STEM Builder functionality into Cocapn Hybrid IDE
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { StemService } from './stem-service';
import type { Env } from './index';

// Create STEM router
export const stemRouter = new Hono<{ Bindings: Env }>();

// STEM middleware
stemRouter.use('*', cors({
  origin: ['https://cocapn.workers.dev', 'https://*.workers.dev', 'http://localhost:8787'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

stemRouter.use('*', logger());

// STEM Project Management
stemRouter.get('/api/stem/projects', async (c) => {
  try {
    const { projectId, userId } = c.req.query();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    if (projectId) {
      const project = await stemService.getSTEMProject(projectId);
      return c.json(project);
    }

    if (userId) {
      // In a real implementation, this would query D1 database for user's STEM projects
      const projects = []; // Placeholder
      return c.json({ projects });
    }

    return c.json({ error: 'projectId or userId required' }, 400);
  } catch (error) {
    console.error('Error getting STEM projects:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

stemRouter.post('/api/stem/projects', async (c) => {
  try {
    const { name, type, complexity, educationalGoals, cocapnProjectId } = await c.req.json();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    if (!name || !type || !complexity || !cocapnProjectId) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const project = await stemService.createSTEMProject({
      name,
      type,
      complexity,
      educationalGoals: educationalGoals || [],
      cocapnProjectId
    });

    return c.json(project, 201);
  } catch (error) {
    console.error('Error creating STEM project:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

stemRouter.put('/api/stem/projects/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const updates = await c.req.json();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    const updatedProject = await stemService.updateSTEMProject(projectId, updates);
    if (!updatedProject) {
      return c.json({ error: 'Project not found' }, 404);
    }

    return c.json(updatedProject);
  } catch (error) {
    console.error('Error updating STEM project:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// STEM Components Library
stemRouter.get('/api/stem/components', async (c) => {
  try {
    const { category, projectId } = c.req.query();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    let components = await stemService.getSTEMComponents(category as string);

    // If projectId is provided, get project-specific components
    if (projectId) {
      // In a real implementation, this would query the junction table
      const projectComponents = components.slice(0, 5); // Placeholder
      return c.json({ components: projectComponents });
    }

    return c.json({ components });
  } catch (error) {
    console.error('Error getting STEM components:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

stemRouter.post('/api/stem/components', async (c) => {
  try {
    const { projectId, componentId, position } = await c.req.json();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    // Add component to project
    // This would update the junction table in a real implementation
    return c.json({
      success: true,
      message: 'Component added to project',
      componentId,
      position
    }, 201);
  } catch (error) {
    console.error('Error adding STEM component:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// STEM Wiring Connections
stemRouter.get('/api/stem/connections', async (c) => {
  try {
    const { projectId } = c.req.query();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    if (!projectId) {
      return c.json({ error: 'projectId required' }, 400);
    }

    const connections = await stemService.getWiringConnections(projectId);
    return c.json({ connections });
  } catch (error) {
    console.error('Error getting STEM connections:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

stemRouter.post('/api/stem/connections', async (c) => {
  try {
    const { projectId, fromComponent, fromPin, toComponent, toPin, wireType } = await c.req.json();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    if (!projectId || !fromComponent || !toComponent || !wireType) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    await stemService.addWiringConnection(projectId, {
      id: crypto.randomUUID(),
      fromComponent,
      fromPin,
      toComponent,
      toPin,
      wireType
    });

    return c.json({ success: true, message: 'Connection added' }, 201);
  } catch (error) {
    console.error('Error adding STEM connection:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// STEM Simulation
stemRouter.post('/api/stem/simulate', async (c) => {
  try {
    const { projectId, components, connections } = await c.req.json();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    if (!projectId) {
      return c.json({ error: 'projectId required' }, 400);
    }

    const result = await stemService.runSimulation(projectId, components, connections);

    return c.json(result);
  } catch (error) {
    console.error('Error running STEM simulation:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      output: {},
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, 500);
  }
});

// STEM Code Generation and Explanation
stemRouter.post('/api/stem/explain', async (c) => {
  try {
    const { concept, code, complexity } = await c.req.json();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    if (!concept || !complexity) {
      return c.json({ error: 'concept and complexity required' }, 400);
    }

    const explanation = await stemService.generateSTEMExplanation(
      concept,
      code || '',
      complexity
    );

    return c.json(explanation);
  } catch (error) {
    console.error('Error generating STEM explanation:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

stemRouter.post('/api/stem/code', async (c) => {
  try {
    const { componentType, properties, language } = await c.req.json();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    if (!componentType || !language) {
      return c.json({ error: 'componentType and language required' }, 400);
    }

    const codeSnippet = await stemService.generateCodeForComponent(
      componentType,
      properties || {},
      language
    );

    return c.json(codeSnippet, 201);
  } catch (error) {
    console.error('Error generating STEM code:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// STEM Learning Paths and Challenges
stemRouter.get('/api/stem/learning-paths', async (c) => {
  try {
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);
    const learningPaths = await stemService.getLearningPaths();
    return c.json({ learningPaths });
  } catch (error) {
    console.error('Error getting STEM learning paths:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

stemRouter.get('/api/stem/challenges', async (c) => {
  try {
    const { difficulty, type } = c.req.query();
    const stemService = new StemService(c.env.KV_AUTH_NAMESPACE);

    const challenges = await stemService.getChallenges(
      difficulty ? parseInt(difficulty as string) : undefined,
      type as any
    );

    return c.json({ challenges });
  } catch (error) {
    console.error('Error getting STEM challenges:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// STEM Project Statistics
stemRouter.get('/api/stem/stats', async (c) => {
  try {
    const { projectId } = c.req.query();

    if (!projectId) {
      return c.json({ error: 'projectId required' }, 400);
    }

    // Mock stats for now - in real implementation, query database
    const stats = {
      componentsCount: 5,
      connectionsCount: 3,
      completedChallenges: 2,
      totalPoints: 150,
      progress: 35
    };

    return c.json({ stats });
  } catch (error) {
    console.error('Error getting STEM stats:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// STEM User Preferences
stemRouter.get('/api/stem/preferences', async (c) => {
  try {
    const userId = c.req.header('Authorization');

    if (!userId) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    // Mock preferences for now - in real implementation, query database
    const preferences = {
      preferredLanguage: 'typescript',
      aiModelPreference: 'educational',
      simulationEnabled: true,
      autoCodeGeneration: true,
      complexityPreference: 3,
      themePreference: 'light'
    };

    return c.json({ preferences });
  } catch (error) {
    console.error('Error getting STEM preferences:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

stemRouter.put('/api/stem/preferences', async (c) => {
  try {
    const userId = c.req.header('Authorization');
    const preferences = await c.req.json();

    if (!userId) {
      return c.json({ error: 'Authorization required' }, 401);
    }

    // In real implementation, update database
    return c.json({
      success: true,
      message: 'Preferences updated',
      preferences
    });
  } catch (error) {
    console.error('Error updating STEM preferences:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// STEM Health Check
stemRouter.get('/api/stem/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'stem-integration',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      projects: true,
      components: true,
      wiring: true,
      simulation: true,
      learning: true,
      codeGeneration: true
    }
  });
});

// Error handling for STEM router
stemRouter.onError((err, c) => {
  console.error('STEM Router error:', err);
  return c.json({
    error: 'Internal server error',
    service: 'stem-integration',
    message: err.message,
    timestamp: new Date().toISOString()
  }, 500);
});

export default stemRouter;