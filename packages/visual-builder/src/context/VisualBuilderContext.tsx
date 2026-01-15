/**
 * Visual Builder Context
 * Central state management for the visual builder
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { ServiceNode, Connection, Requirement, Template, Architecture, CostBreakdown } from '../types';

// State interface
interface VisualBuilderState {
  // Canvas state
  canvas: {
    services: ServiceNode[];
    connections: Connection[];
    selectedNode: string | null;
    canvasPosition: { x: number; y: number };
    canvasScale: number;
  };

  // Project state
  project: {
    name: string;
    description: string;
    type: 'saas' | 'api' | 'frontend' | 'backend' | 'fullstack';
    features: string[];
    requirements: Requirement[];
    constraints: any[];
  };

  // Architecture state
  architecture: {
    selectedTemplate: Template | null;
    recommendation: Architecture | null;
    costEstimate: CostBreakdown | null;
    resources: any;
  };

  // UI state
  ui: {
    activeTab: 'design' | 'requirements' | 'costs' | 'preview';
    sidebarOpen: boolean;
    propertiesPanelOpen: boolean;
    loading: boolean;
    error: string | null;
  };

  // History state
  history: {
    past: VisualBuilderState[];
    future: VisualBuilderState[];
  };
}

// Action types
type VisualBuilderAction =
  | { type: 'ADD_SERVICE'; payload: ServiceNode }
  | { type: 'UPDATE_SERVICE'; payload: { id: string; updates: Partial<ServiceNode> } }
  | { type: 'DELETE_SERVICE'; payload: string }
  | { type: 'ADD_CONNECTION'; payload: Connection }
  | { type: 'DELETE_CONNECTION'; payload: string }
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'UPDATE_CANVAS_POSITION'; payload: { x: number; y: number } }
  | { type: 'UPDATE_CANVAS_SCALE'; payload: number }
  | { type: 'UPDATE_PROJECT_NAME'; payload: string }
  | { type: 'UPDATE_PROJECT_DESCRIPTION'; payload: string }
  | { type: 'UPDATE_PROJECT_TYPE'; payload: 'saas' | 'api' | 'frontend' | 'backend' | 'fullstack' }
  | { type: 'ADD_FEATURE'; payload: string }
  | { type: 'REMOVE_FEATURE'; payload: string }
  | { type: 'ADD_REQUIREMENT'; payload: Requirement }
  | { type: 'UPDATE_REQUIREMENT'; payload: { id: string; updates: Partial<Requirement> } }
  | { type: 'DELETE_REQUIREMENT'; payload: string }
  | { type: 'SET_SELECTED_TEMPLATE'; payload: Template }
  | { type: 'SET_ARCHITECTURE_RECOMMENDATION'; payload: Architecture }
  | { type: 'SET_COST_ESTIMATE'; payload: CostBreakdown }
  | { type: 'SET_ACTIVE_TAB'; payload: VisualBuilderState['ui']['activeTab'] }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_PROPERTIES_PANEL' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' };

// Initial state
const initialState: VisualBuilderState = {
  canvas: {
    services: [],
    connections: [],
    selectedNode: null,
    canvasPosition: { x: 0, y: 0 },
    canvasScale: 1,
  },

  project: {
    name: 'My Cloudflare Application',
    description: '',
    type: 'saas',
    features: [],
    requirements: [],
    constraints: [],
  },

  architecture: {
    selectedTemplate: null,
    recommendation: null,
    costEstimate: null,
    resources: null,
  },

  ui: {
    activeTab: 'design',
    sidebarOpen: true,
    propertiesPanelOpen: true,
    loading: false,
    error: null,
  },

  history: {
    past: [],
    future: [],
  },
};

// Reducer
function visualBuilderReducer(state: VisualBuilderState, action: VisualBuilderAction): VisualBuilderState {
  switch (action.type) {
    case 'ADD_SERVICE':
      return {
        ...state,
        canvas: {
          ...state.canvas,
          services: [...state.canvas.services, action.payload],
        },
      };

    case 'UPDATE_SERVICE':
      return {
        ...state,
        canvas: {
          ...state.canvas,
          services: state.canvas.services.map(service =>
            service.id === action.payload.id
              ? { ...service, ...action.payload.updates }
              : service
          ),
        },
      };

    case 'DELETE_SERVICE':
      // Also delete connections to/from this service
      const connectionsToDelete = state.canvas.connections.filter(
        conn => conn.source === action.payload || conn.target === action.payload
      );

      return {
        ...state,
        canvas: {
          ...state.canvas,
          services: state.canvas.services.filter(service => service.id !== action.payload),
          connections: state.canvas.connections.filter(
            conn => conn.source !== action.payload && conn.target !== action.payload
          ),
        },
      };

    case 'ADD_CONNECTION':
      return {
        ...state,
        canvas: {
          ...state.canvas,
          connections: [...state.canvas.connections, action.payload],
        },
      };

    case 'DELETE_CONNECTION':
      return {
        ...state,
        canvas: {
          ...state.canvas,
          connections: state.canvas.connections.filter(conn => conn.id !== action.payload),
        },
      };

    case 'SELECT_NODE':
      return {
        ...state,
        canvas: {
          ...state.canvas,
          selectedNode: action.payload,
        },
      };

    case 'UPDATE_CANVAS_POSITION':
      return {
        ...state,
        canvas: {
          ...state.canvas,
          canvasPosition: action.payload,
        },
      };

    case 'UPDATE_CANVAS_SCALE':
      return {
        ...state,
        canvas: {
          ...state.canvas,
          canvasScale: action.payload,
        },
      };

    case 'UPDATE_PROJECT_NAME':
      return {
        ...state,
        project: {
          ...state.project,
          name: action.payload,
        },
      };

    case 'UPDATE_PROJECT_DESCRIPTION':
      return {
        ...state,
        project: {
          ...state.project,
          description: action.payload,
        },
      };

    case 'UPDATE_PROJECT_TYPE':
      return {
        ...state,
        project: {
          ...state.project,
          type: action.payload,
        },
      };

    case 'ADD_FEATURE':
      return {
        ...state,
        project: {
          ...state.project,
          features: [...state.project.features, action.payload],
        },
      };

    case 'REMOVE_FEATURE':
      return {
        ...state,
        project: {
          ...state.project,
          features: state.project.features.filter(feature => feature !== action.payload),
        },
      };

    case 'ADD_REQUIREMENT':
      return {
        ...state,
        project: {
          ...state.project,
          requirements: [...state.project.requirements, action.payload],
        },
      };

    case 'UPDATE_REQUIREMENT':
      return {
        ...state,
        project: {
          ...state.project,
          requirements: state.project.requirements.map(req =>
            req.id === action.payload.id
              ? { ...req, ...action.payload.updates }
              : req
          ),
        },
      };

    case 'DELETE_REQUIREMENT':
      return {
        ...state,
        project: {
          ...state.project,
          requirements: state.project.requirements.filter(req => req.id !== action.payload),
        },
      };

    case 'SET_SELECTED_TEMPLATE':
      return {
        ...state,
        architecture: {
          ...state.architecture,
          selectedTemplate: action.payload,
        },
      };

    case 'SET_ARCHITECTURE_RECOMMENDATION':
      return {
        ...state,
        architecture: {
          ...state.architecture,
          recommendation: action.payload,
        },
      };

    case 'SET_COST_ESTIMATE':
      return {
        ...state,
        architecture: {
          ...state.architecture,
          costEstimate: action.payload,
        },
      };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        ui: {
          ...state.ui,
          activeTab: action.payload,
        },
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        ui: {
          ...state.ui,
          sidebarOpen: !state.ui.sidebarOpen,
        },
      };

    case 'TOGGLE_PROPERTIES_PANEL':
      return {
        ...state,
        ui: {
          ...state.ui,
          propertiesPanelOpen: !state.ui.propertiesPanelOpen,
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        ui: {
          ...state.ui,
          loading: action.payload,
        },
      };

    case 'SET_ERROR':
      return {
        ...state,
        ui: {
          ...state.ui,
          error: action.payload,
        },
      };

    case 'UNDO':
      if (state.history.past.length === 0) return state;

      const previousState = state.history.past[state.history.past.length - 1];
      return {
        ...previousState,
        history: {
          past: state.history.past.slice(0, -1),
          future: [state, ...state.history.future],
        },
      };

    case 'REDO':
      if (state.history.future.length === 0) return state;

      const nextState = state.history.future[0];
      return {
        ...nextState,
        history: {
          past: [...state.history.past, state],
          future: state.history.future.slice(1),
        },
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// Context
const VisualBuilderContext = createContext<{
  state: VisualBuilderState;
  dispatch: React.Dispatch<VisualBuilderAction>;
} | null>(null);

// Provider
export function VisualBuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(visualBuilderReducer, initialState);

  return (
    <VisualBuilderContext.Provider value={{ state, dispatch }}>
      {children}
    </VisualBuilderContext.Provider>
  );
}

// Hook
export function useVisualBuilder() {
  const context = useContext(VisualBuilderContext);
  if (!context) {
    throw new Error('useVisualBuilder must be used within a VisualBuilderProvider');
  }
  return context;
}

// Selectors for easier state access
export function useCanvas() {
  const { state } = useVisualBuilder();
  return state.canvas;
}

export function useServices() {
  const { state } = useVisualBuilder();
  return state.canvas.services;
}

export function useSelectedNode() {
  const { state } = useVisualBuilder();
  const selectedNode = state.canvas.services.find(
    service => service.id === state.canvas.selectedNode
  );
  return selectedNode;
}

export function useConnections() {
  const { state } = useVisualBuilder();
  return state.canvas.connections;
}

export function useProject() {
  const { state } = useVisualBuilder();
  return state.project;
}

export function useRequirements() {
  const { state } = useVisualBuilder();
  return state.project.requirements;
}

export function useArchitecture() {
  const { state } = useVisualBuilder();
  return state.architecture;
}

export function useCosts() {
  const { state } = useVisualBuilder();
  return state.architecture.costEstimate;
}

export function useUI() {
  const { state } = useVisualBuilder();
  return state.ui;
}

export function useHistory() {
  const { state } = useVisualBuilder();
  return state.history;
}