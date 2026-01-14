/**
 * Advanced Routing Example
 *
 * This example demonstrates advanced routing features including:
 * - Canary deployments
 * - Blue-green deployments
 * - A/B testing
 * - Header-based routing
 * - Weight-based traffic splitting
 */

import { createRouter, createRoute, createRateLimitRPM, createRateLimitRPS } from '../src';
import type { GatewayRequest, GatewayContext } from '../src/types';

// Create router
const router = createRouter({
  cacheEnabled: true,
  cacheMaxSize: 10000,
});

// Example 1: Canary deployment
const canaryRoute = createRoute({
  id: 'canary-deployment',
  name: 'Canary Deployment',
  path: '/api/v2/features',
  methods: ['GET'],
  upstream: {
    type: 'weighted',
    targets: [
      {
        id: 'stable-version',
        url: 'https://api-stable.example.com',
        weight: 90, // 90% traffic to stable version
      },
      {
        id: 'canary-version',
        url: 'https://api-canary.example.com',
        weight: 10, // 10% traffic to canary version
      },
    ],
  },
  middleware: [],
  auth: { required: false, methods: ['none'] },
});

router.addRoute(canaryRoute);

// Example 2: Blue-green deployment
const blueGreenRoute = createRoute({
  id: 'blue-green-deployment',
  name: 'Blue-Green Deployment',
  path: '/api/v2/resources',
  methods: ['GET'],
  upstream: {
    type: 'single',
    targets: [
      {
        id: 'blue-environment',
        url: 'https://api-blue.example.com',
      },
    ],
  },
  middleware: [],
  auth: { required: false, methods: ['none'] },
});

router.addRoute(blueGreenRoute);

// Function to switch from blue to green
function switchToGreen() {
  router.removeRoute('blue-green-deployment');

  const greenRoute = createRoute({
    id: 'blue-green-deployment',
    name: 'Blue-Green Deployment',
    path: '/api/v2/resources',
    methods: ['GET'],
    upstream: {
      type: 'single',
      targets: [
        {
          id: 'green-environment',
          url: 'https://api-green.example.com',
        },
      ],
    },
    middleware: [],
    auth: { required: false, methods: ['none'] },
  });

  router.addRoute(greenRoute);
}

// Example 3: A/B testing with header-based routing
const abTestRoute = createRoute({
  id: 'ab-test-route',
  name: 'A/B Test Route',
  path: '/api/experiment',
  methods: ['GET'],
  upstream: {
    type: 'single',
    targets: [
      {
        id: 'experiment-control',
        url: 'https://api-control.example.com',
      },
    ],
  },
  middleware: [],
  auth: { required: false, methods: ['none'] },
});

router.addRoute(abTestRoute);

// Function to route based on A/B test group
async function routeABTest(request: GatewayRequest, context: GatewayContext) {
  const experimentGroup = request.headers.get('X-Experiment-Group');

  if (experimentGroup === 'variant') {
    // Route to variant
    const variantTarget = {
      id: 'experiment-variant',
      url: 'https://api-variant.example.com',
    };

    return variantTarget;
  } else {
    // Route to control (default)
    const controlTarget = {
      id: 'experiment-control',
      url: 'https://api-control.example.com',
    };

    return controlTarget;
  }
}

// Example 4: Progressive rollout
async function progressiveRollout() {
  const rolloutSteps = [
    { percentage: 5, duration: 3600000 },    // 5% for 1 hour
    { percentage: 25, duration: 3600000 },   // 25% for 1 hour
    { percentage: 50, duration: 3600000 },   // 50% for 1 hour
    { percentage: 100, duration: Infinity }, // 100% forever
  ];

  for (const step of rolloutSteps) {
    console.log(`Rolling out to ${step.percentage}% of traffic`);

    router.removeRoute('progressive-rollout');

    const rolloutRoute = createRoute({
      id: 'progressive-rollout',
      name: 'Progressive Rollout',
      path: '/api/v3/new-feature',
      methods: ['GET'],
      upstream: {
        type: 'weighted',
        targets: [
          {
            id: 'old-version',
            url: 'https://api-old.example.com',
            weight: 100 - step.percentage,
          },
          {
            id: 'new-version',
            url: 'https://api-new.example.com',
            weight: step.percentage,
          },
        ],
      },
      middleware: [],
      auth: { required: false, methods: ['none'] },
    });

    router.addRoute(rolloutRoute);

    // Wait for the specified duration
    await new Promise(resolve => setTimeout(resolve, step.duration));
  }
}

// Example 5: Geographic routing
function routeByRegion(request: GatewayRequest): string {
  const country = request.metadata.country;

  switch (country) {
    case 'US':
      return 'https://api-us.example.com';
    case 'EU':
      return 'https://api-eu.example.com';
    case 'APAC':
      return 'https://api-apac.example.com';
    default:
      return 'https://api-global.example.com';
  }
}

// Example 6: Device-based routing
function routeByDevice(request: GatewayRequest): string {
  const userAgent = request.userAgent.toLowerCase();

  if (userAgent.includes('mobile')) {
    return 'https://api-mobile.example.com';
  } else if (userAgent.includes('tablet')) {
    return 'https://api-tablet.example.com';
  } else {
    return 'https://api-desktop.example.com';
  }
}

// Example 7: Custom routing logic
async function customRouting(request: GatewayRequest, context: GatewayContext) {
  // Match the route
  const match = await router.match(request, context);

  if (!match) {
    return null;
  }

  // Apply custom routing logic
  const customTarget = await routeABTest(request, context);

  if (customTarget) {
    return customTarget;
  }

  // Fall back to default routing
  return await router.routeToTarget(request, context, match.route.upstream);
}

// Export examples
export {
  router,
  switchToGreen,
  routeABTest,
  progressiveRollout,
  routeByRegion,
  routeByDevice,
  customRouting,
};
