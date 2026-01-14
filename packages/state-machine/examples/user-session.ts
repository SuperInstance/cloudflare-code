/**
 * User Session Management Example
 * Demonstrates hierarchical states and session lifecycle
 */

import { createStateMachine, StateManager } from '../src/index.js';

interface SessionContext {
  userId?: string;
  username?: string;
  loginAttempts: number;
  lastActivity: number;
  sessionTimeout: number;
}

const sessionDefinition = {
  initial: 'guest',
  context: {
    userId: undefined,
    username: undefined,
    loginAttempts: 0,
    lastActivity: Date.now(),
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
  } as SessionContext,
  states: {
    guest: {
      onEntry: ctx => console.log('👤 Guest session'),
      transitions: [
        {
          from: 'guest',
          to: 'authenticating',
          on: 'LOGIN',
          action: ctx => {
            console.log(`🔐 Login attempt for ${(ctx.payload as any)?.username}`);
          },
        },
      ],
    },
    authenticating: {
      onEntry: ctx => {
        ctx.data!.loginAttempts++;
        console.log(`🔑 Authenticating... (attempt ${ctx.data?.loginAttempts})`);
      },
      transitions: [
        {
          from: 'authenticating',
          to: 'authenticated',
          on: 'SUCCESS',
          guard: ctx => {
            const attempts = ctx.data?.loginAttempts || 0;
            return attempts <= 3;
          },
          action: ctx => {
            const payload = ctx.payload as any;
            ctx.data!.userId = payload?.userId;
            ctx.data!.username = payload?.username;
            ctx.data!.lastActivity = Date.now();
            console.log(`✅ User logged in: ${ctx.data?.username}`);
          },
        },
        {
          from: 'authenticating',
          to: 'locked',
          on: 'FAILURE',
          guard: ctx => {
            return (ctx.data?.loginAttempts || 0) >= 3;
          },
          action: ctx => {
            console.log(`🔒 Account locked after ${ctx.data?.loginAttempts} failed attempts`);
          },
        },
        {
          from: 'authenticating',
          to: 'guest',
          on: 'FAILURE',
          action: ctx => {
            console.log(`❌ Login failed, returning to guest`);
          },
        },
      ],
    },
    authenticated: {
      onEntry: ctx => {
        ctx.data!.lastActivity = Date.now();
        console.log(`🎉 Authenticated session: ${ctx.data?.username}`);
      },
      transitions: [
        {
          from: 'authenticated',
          to: 'active',
          on: 'ACTIVITY',
          action: ctx => {
            ctx.data!.lastActivity = Date.now();
          },
        },
        {
          from: 'authenticated',
          to: 'guest',
          on: 'LOGOUT',
          action: ctx => {
            console.log(`👋 User logged out: ${ctx.data?.username}`);
            ctx.data!.userId = undefined;
            ctx.data!.username = undefined;
            ctx.data!.loginAttempts = 0;
          },
        },
      ],
    },
    active: {
      initial: 'browsing',
      states: {
        browsing: {
          onEntry: () => console.log('👀 Browsing'),
          transitions: [
            {
              from: 'browsing',
              to: 'active.shopping',
              on: 'ADD_TO_CART',
            },
            {
              from: 'browsing',
              to: 'active.profile',
              on: 'VIEW_PROFILE',
            },
          ],
        },
        shopping: {
          onEntry: () => console.log('🛒 Shopping'),
          transitions: [
            {
              from: 'shopping',
              to: 'active.browsing',
              on: 'CONTINUE',
            },
            {
              from: 'shopping',
              to: 'active.checkout',
              on: 'CHECKOUT',
            },
          ],
        },
        checkout: {
          onEntry: () => console.log('💳 Checkout'),
          transitions: [
            {
              from: 'checkout',
              to: 'active.browsing',
              on: 'CONTINUE',
            },
          ],
        },
        profile: {
          onEntry: () => console.log('👤 Profile'),
          transitions: [
            {
              from: 'profile',
              to: 'active.browsing',
              on: 'BACK',
            },
          ],
        },
      },
    },
    locked: {
      onEntry: ctx => {
        console.log(`🔒 Account locked for ${ctx.data?.username || 'unknown'}`);
      },
      transitions: [
        {
          from: 'locked',
          to: 'guest',
          on: 'UNLOCK',
          action: ctx => {
            ctx.data!.loginAttempts = 0;
            console.log(`🔓 Account unlocked`);
          },
        },
      ],
    },
  },
};

async function demonstrateSessionManagement() {
  console.log('🔐 User Session Management Demo\n');

  const session = createStateMachine(sessionDefinition, {
    enableMetrics: true,
  });

  const manager = new StateManager(session, {
    enableValidation: true,
  });

  // Scenario 1: Failed login
  console.log('\n--- Scenario 1: Failed Login ---');
  await session.send('LOGIN', { username: 'john_doe' });
  await session.send('FAILURE');

  // Scenario 2: Another failed attempt
  console.log('\n--- Scenario 2: Second Failed Attempt ---');
  await session.send('LOGIN', { username: 'john_doe' });
  await session.send('FAILURE');

  // Scenario 3: Account gets locked
  console.log('\n--- Scenario 3: Account Locked ---');
  await session.send('LOGIN', { username: 'john_doe' });
  await session.send('FAILURE');
  console.log('State:', session.state);

  // Scenario 4: Unlock and successful login
  console.log('\n--- Scenario 4: Unlock and Login ---');
  await session.send('UNLOCK');
  await session.send('LOGIN', { username: 'john_doe' });
  await session.send('SUCCESS', {
    userId: 'user-123',
    username: 'john_doe',
  });
  console.log('State:', session.state);

  // Scenario 5: User activity
  console.log('\n--- Scenario 5: User Activity ---');
  await session.send('ACTIVITY');
  await session.send('ADD_TO_CART');
  console.log('Current state:', session.state);

  // Scenario 6: Checkout
  console.log('\n--- Scenario 6: Checkout ---');
  await session.send('CHECKOUT');
  console.log('Current state:', session.state);

  // Scenario 7: Logout
  console.log('\n--- Scenario 7: Logout ---');
  await session.send('LOGOUT');
  console.log('State:', session.state);

  // Show session statistics
  console.log('\n📊 Session Statistics:');
  const stats = manager.getStateStatistics();
  console.log(`Total transitions: ${stats.totalTransitions}`);
  console.log(`Current state: ${stats.currentState}`);
  console.log(`History length: ${stats.historyLength}`);
  console.log(`Most visited state: ${stats.mostVisitedState}`);

  // Create checkpoint
  console.log('\n💾 Creating session checkpoint...');
  await manager.checkpoint('After demo');

  // Show coverage
  console.log('\n📈 State Coverage:');
  const allStates = Object.keys(sessionDefinition.states);
  const visitedStates = new Set(session.history);
  console.log(`Visited ${visitedStates.size}/${allStates.length} states`);

  return session;
}

// Run the demonstration
demonstrateSessionManagement()
  .then(() => console.log('\n✅ Session management demo complete'))
  .catch(err => console.error('❌ Error:', err));
