/**
 * Utility functions for state machine operations
 */

import {
  State,
  StateMachineDefinition,
  StateDefinition,
  Transition,
} from '../types/index.js';

/**
 * Validate state machine definition
 */
export function validateDefinition<TData = any>(
  definition: StateMachineDefinition<TData>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check initial state
  if (!definition.initial) {
    errors.push('Initial state is required');
  } else if (!definition.states[definition.initial]) {
    errors.push(`Initial state '${definition.initial}' not found in states`);
  }

  // Check states exist
  if (!definition.states || Object.keys(definition.states).length === 0) {
    errors.push('At least one state is required');
  }

  // Check state transitions
  for (const [stateName, stateDef] of Object.entries(definition.states)) {
    if (stateDef.transitions) {
      for (const transition of stateDef.transitions) {
        if (!transition.to) {
          errors.push(`Transition from '${stateName}' missing target state`);
        } else if (!definition.states[transition.to]) {
          errors.push(`Transition from '${stateName}' to unknown state '${transition.to}'`);
        }

        if (!transition.on) {
          errors.push(`Transition from '${stateName}' missing event`);
        }
      }
    }

    // Check compound state initial
    if (stateDef.initial && !definition.states[stateDef.initial]) {
      errors.push(`Compound state '${stateName}' has invalid initial state '${stateDef.initial}'`);
    }
  }

  // Check global transitions
  if (definition.transitions) {
    for (const transition of definition.transitions) {
      if (!transition.to) {
        errors.push('Global transition missing target state');
      }

      if (transition.from !== '*' && Array.isArray(transition.from)) {
        for (const from of transition.from) {
          if (!definition.states[from]) {
            errors.push(`Global transition from unknown state '${from}'`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Find unreachable states
 */
export function findUnreachableStates<TData = any>(
  definition: StateMachineDefinition<TData>
): State[] {
  const reachable = new Set<State>();
  const queue: State[] = [definition.initial];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (reachable.has(current)) {
      continue;
    }

    reachable.add(current);

    const stateDef = definition.states[current];
    if (stateDef?.transitions) {
      for (const transition of stateDef.transitions) {
        if (!reachable.has(transition.to)) {
          queue.push(transition.to);
        }
      }
    }

    // Check global transitions
    if (definition.transitions) {
      for (const transition of definition.transitions) {
        if (transition.from === '*' || transition.from === current) {
          if (!reachable.has(transition.to)) {
            queue.push(transition.to);
          }
        }
      }
    }

    // Check compound states
    if (stateDef?.initial) {
      if (!reachable.has(stateDef.initial)) {
        queue.push(stateDef.initial);
      }
    }
  }

  const allStates = new Set(Object.keys(definition.states));
  const unreachable: State[] = [];

  for (const state of allStates) {
    if (!reachable.has(state)) {
      unreachable.push(state);
    }
  }

  return unreachable;
}

/**
 * Find dead-end states (states with no outgoing transitions)
 */
export function findDeadEndStates<TData = any>(
  definition: StateMachineDefinition<TData>
): State[] {
  const deadEnds: State[] = [];

  for (const [stateName, stateDef] of Object.entries(definition.states)) {
    // Final states are not considered dead ends
    if (stateDef.final) {
      continue;
    }

    const transitions = stateDef.transitions || [];

    // Check if global transitions apply
    let hasGlobalTransition = false;
    if (definition.transitions) {
      for (const transition of definition.transitions) {
        if (transition.from === '*' || transition.from === stateName) {
          hasGlobalTransition = true;
          break;
        }
      }
    }

    if (transitions.length === 0 && !hasGlobalTransition && !stateDef.parallel) {
      deadEnds.push(stateName);
    }
  }

  return deadEnds;
}

/**
 * Detect state cycles
 */
export function detectCycles<TData = any>(
  definition: StateMachineDefinition<TData>
): State[][] {
  const cycles: State[][] = [];
  const visited = new Set<State>();
  const recursionStack = new Set<State>();
  const currentPath: State[] = [];

  const dfs = (state: State): void => {
    visited.add(state);
    recursionStack.add(state);
    currentPath.push(state);

    const stateDef = definition.states[state];
    if (stateDef?.transitions) {
      for (const transition of stateDef.transitions) {
        if (!visited.has(transition.to)) {
          dfs(transition.to);
        } else if (recursionStack.has(transition.to)) {
          // Found a cycle
          const cycleStart = currentPath.indexOf(transition.to);
          const cycle = currentPath.slice(cycleStart);
          cycle.push(transition.to);
          cycles.push(cycle);
        }
      }
    }

    // Check global transitions
    if (definition.transitions) {
      for (const transition of definition.transitions) {
        if (transition.from === '*' || transition.from === state) {
          if (!visited.has(transition.to)) {
            dfs(transition.to);
          } else if (recursionStack.has(transition.to)) {
            const cycleStart = currentPath.indexOf(transition.to);
            const cycle = currentPath.slice(cycleStart);
            cycle.push(transition.to);
            cycles.push(cycle);
          }
        }
      }
    }

    recursionStack.delete(state);
    currentPath.pop();
  };

  dfs(definition.initial);

  return cycles;
}

/**
 * Calculate state machine complexity
 */
export function calculateComplexity<TData = any>(
  definition: StateMachineDefinition<TData>
): {
  stateCount: number;
  transitionCount: number;
  avgTransitionsPerState: number;
  maxTransitionsFromState: number;
  complexityScore: number;
} {
  const stateCount = Object.keys(definition.states).length;
  let transitionCount = 0;
  let maxTransitions = 0;

  for (const stateDef of Object.values(definition.states)) {
    const count = stateDef.transitions?.length || 0;
    transitionCount += count;
    maxTransitions = Math.max(maxTransitions, count);
  }

  // Add global transitions
  if (definition.transitions) {
    transitionCount += definition.transitions.length;
  }

  // Cyclomatic complexity-like calculation
  const complexityScore = transitionCount - stateCount + 2;

  return {
    stateCount,
    transitionCount,
    avgTransitionsPerState: transitionCount / Math.max(1, stateCount),
    maxTransitionsFromState: maxTransitions,
    complexityScore,
  };
}

/**
 * Optimize state machine definition
 */
export function optimizeDefinition<TData = any>(
  definition: StateMachineDefinition<TData>
): StateMachineDefinition<TData> {
  const optimized: StateMachineDefinition<TData> = {
    ...definition,
    states: {},
  };

  // Remove unreachable states
  const unreachable = findUnreachableStates(definition);

  for (const [stateName, stateDef] of Object.entries(definition.states)) {
    if (!unreachable.includes(stateName)) {
      optimized.states[stateName] = stateDef;
    }
  }

  // Merge duplicate transitions
  for (const [stateName, stateDef] of Object.entries(optimized.states)) {
    if (stateDef.transitions && stateDef.transitions.length > 0) {
      const transitionMap = new Map<string, Transition<TData>>();

      for (const transition of stateDef.transitions) {
        const key = `${transition.on}:${transition.to}`;
        const existing = transitionMap.get(key);

        if (!existing) {
          transitionMap.set(key, transition);
        } else if (transition.priority && transition.priority > (existing.priority || 0)) {
          transitionMap.set(key, transition);
        }
      }

      stateDef.transitions = Array.from(transitionMap.values());
    }
  }

  return optimized;
}

/**
 * Clone state machine definition
 */
export function cloneDefinition<TData = any>(
  definition: StateMachineDefinition<TData>
): StateMachineDefinition<TData> {
  return JSON.parse(JSON.stringify(definition));
}

/**
 * Merge state machine definitions
 */
export function mergeDefinitions<TData = any>(
  ...definitions: StateMachineDefinition<TData>[]
): StateMachineDefinition<TData> {
  if (definitions.length === 0) {
    throw new Error('At least one definition is required');
  }

  const merged: StateMachineDefinition<TData> = {
    initial: definitions[0].initial,
    states: {},
    transitions: [],
    id: definitions[0].id,
    version: definitions[0].version,
    metadata: definitions[0].metadata,
  };

  for (const definition of definitions) {
    // Merge states
    for (const [stateName, stateDef] of Object.entries(definition.states)) {
      if (merged.states[stateName]) {
        // Merge transitions
        const existing = merged.states[stateName];
        if (stateDef.transitions) {
          existing.transitions = [
            ...(existing.transitions || []),
            ...stateDef.transitions,
          ];
        }
      } else {
        merged.states[stateName] = { ...stateDef };
      }
    }

    // Merge global transitions
    if (definition.transitions) {
      merged.transitions!.push(...definition.transitions);
    }
  }

  return merged;
}

/**
 * Convert state machine to JSON schema
 */
export function toJSONSchema<TData = any>(
  definition: StateMachineDefinition<TData>
): object {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: `State Machine: ${definition.id || 'Unnamed'}`,
    type: 'object',
    properties: {
      initial: {
        type: 'string',
        const: definition.initial,
        description: 'Initial state',
      },
      states: {
        type: 'object',
        description: 'State definitions',
        properties: Object.fromEntries(
          Object.entries(definition.states).map(([name, def]) => [
            name,
            {
              type: 'object',
              properties: {
                initial: def.initial ? { type: 'string' } : undefined,
                final: def.final ? { type: 'boolean' } : undefined,
                parent: def.parent ? { type: 'string' } : undefined,
                history: def.history ? { type: 'string', enum: ['shallow', 'deep'] } : undefined,
              },
            },
          ])
        ),
      },
    },
    required: ['initial', 'states'],
  };
}

/**
 * Generate state transition table
 */
export function generateTransitionTable<TData = any>(
  definition: StateMachineDefinition<TData>
): Array<{ from: State; to: State; event: string; guard?: boolean; action?: boolean }> {
  const table: Array<{ from: State; to: State; event: string; guard?: boolean; action?: boolean }> = [];

  for (const [stateName, stateDef] of Object.entries(definition.states)) {
    if (stateDef.transitions) {
      for (const transition of stateDef.transitions) {
        table.push({
          from: stateName,
          to: transition.to,
          event: transition.on,
          guard: !!transition.guard,
          action: !!transition.action,
        });
      }
    }
  }

  // Add global transitions
  if (definition.transitions) {
    for (const transition of definition.transitions) {
      if (transition.from === '*') {
        for (const stateName of Object.keys(definition.states)) {
          table.push({
            from: stateName,
            to: transition.to,
            event: transition.on,
            guard: !!transition.guard,
            action: !!transition.action,
          });
        }
      } else if (Array.isArray(transition.from)) {
        for (const from of transition.from) {
          table.push({
            from,
            to: transition.to,
            event: transition.on,
            guard: !!transition.guard,
            action: !!transition.action,
          });
        }
      } else {
        table.push({
          from: transition.from as State,
          to: transition.to,
          event: transition.on,
          guard: !!transition.guard,
          action: !!transition.action,
        });
      }
    }
  }

  return table;
}

/**
 * Format state path for display
 */
export function formatPath(path: State[]): string {
  return path.join(' → ');
}

/**
 * Compare state paths
 */
export function comparePaths(path1: State[], path2: State[]): number {
  if (path1.length !== path2.length) {
    return path1.length - path2.length;
  }

  for (let i = 0; i < path1.length; i++) {
    if (path1[i] !== path2[i]) {
      return path1[i].localeCompare(path2[i]);
    }
  }

  return 0;
}

/**
 * Find shortest path between states
 */
export function findShortestPath<TData = any>(
  definition: StateMachineDefinition<TData>,
  from: State,
  to: State
): State[] | null {
  if (from === to) {
    return [from];
  }

  const queue: Array<{ state: State; path: State[] }> = [
    { state: from, path: [from] },
  ];
  const visited = new Set<State>([from]);

  while (queue.length > 0) {
    const { state, path } = queue.shift()!;

    const stateDef = definition.states[state];
    const transitions = stateDef?.transitions || [];

    for (const transition of transitions) {
      if (transition.to === to) {
        return [...path, to];
      }

      if (!visited.has(transition.to)) {
        visited.add(transition.to);
        queue.push({
          state: transition.to,
          path: [...path, transition.to],
        });
      }
    }

    // Check global transitions
    if (definition.transitions) {
      for (const transition of definition.transitions) {
        if (transition.from === '*' || transition.from === state) {
          if (transition.to === to) {
            return [...path, to];
          }

          if (!visited.has(transition.to)) {
            visited.add(transition.to);
            queue.push({
              state: transition.to,
              path: [...path, transition.to],
            });
          }
        }
      }
    }
  }

  return null;
}

/**
 * Calculate state machine depth
 */
export function calculateDepth<TData = any>(
  definition: StateMachineDefinition<TData>
): number {
  let maxDepth = 0;

  const dfs = (state: State, depth: number): void => {
    maxDepth = Math.max(maxDepth, depth);

    const stateDef = definition.states[state];
    if (stateDef?.transitions) {
      for (const transition of stateDef.transitions) {
        dfs(transition.to, depth + 1);
      }
    }
  };

  dfs(definition.initial, 0);

  return maxDepth;
}
