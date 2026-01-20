/**
 * STEM Panel Component
 *
 * Integration of STEM Builder functionality into Cocapn Hybrid IDE
 */

import { h, JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';

interface STEMPanelProps {
  projectId: string;
  onProjectUpdate?: (project: any) => void;
}

interface STEMComponent {
  id: string;
  name: string;
  category: string;
  description: string;
  properties: Record<string, any>;
  pins: any[];
  complexity: number;
  tags: string[];
}

interface WiringConnection {
  id: string;
  fromComponent: string;
  fromPin: string;
  toComponent: string;
  toPin: string;
  wireType: string;
}

interface ProjectStats {
  componentsCount: number;
  connectionsCount: number;
  completedChallenges: number;
  totalPoints: number;
  progress: number;
}

export function STEMPanel({ projectId, onProjectUpdate }: STEMPanelProps) {
  const [activeTab, setActiveTab] = useState<'components' | 'wiring' | 'simulation' | 'learning'>('components');
  const [components, setComponents] = useState<STEMComponent[]>([]);
  const [connections, setConnections] = useState<WiringConnection[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStats>({
    componentsCount: 0,
    connectionsCount: 0,
    completedChallenges: 0,
    totalPoints: 0,
    progress: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Load STEM project data
  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  const loadProjectData = async () => {
    setLoading(true);
    try {
      // Load components
      const componentsResponse = await fetch(`/api/stem/components?projectId=${projectId}`);
      const componentsData = await componentsResponse.json();
      setComponents(componentsData.components || []);

      // Load connections
      const connectionsResponse = await fetch(`/api/stem/connections?projectId=${projectId}`);
      const connectionsData = await connectionsResponse.json();
      setConnections(connectionsData.connections || []);

      // Load project stats
      const statsResponse = await fetch(`/api/stem/stats?projectId=${projectId}`);
      const statsData = await statsResponse.json();
      setProjectStats(statsData.stats || projectStats);
    } catch (error) {
      console.error('Error loading STEM project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComponent = async (componentId: string) => {
    try {
      const response = await fetch(`/api/stem/components`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, componentId, position: { x: 100, y: 100 } })
      });

      if (response.ok) {
        await loadProjectData();
        onProjectUpdate?.(await response.json());
      }
    } catch (error) {
      console.error('Error adding component:', error);
    }
  };

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stem/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, components, connections })
      });

      const result = await response.json();
      setSimulationResult(result);
    } catch (error) {
      console.error('Error running simulation:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderComponentsTab = () => (
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">STEM Components Library</h3>
        <div class="flex gap-2">
          <select class="px-3 py-1 border rounded-md text-sm">
            <option>All Categories</option>
            <option>Electronic</option>
            <option>Mechanical</option>
            <option>Sensor</option>
            <option>Actuator</option>
            <option>Control</option>
          </select>
          <input
            type="text"
            placeholder="Search components..."
            class="px-3 py-1 border rounded-md text-sm w-64"
          />
        </div>
      </div>

      {loading ? (
        <div class="text-center py-8 text-gray-500">Loading components...</div>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {components.map((component) => (
            <div
              key={component.id}
              class="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
              onClick={() => handleAddComponent(component.id)}
            >
              <div class="flex items-start justify-between mb-2">
                <h4 class="font-medium text-sm">{component.name}</h4>
                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {component.category}
                </span>
              </div>
              <p class="text-xs text-gray-600 mb-3 line-clamp-2">
                {component.description}
              </p>
              <div class="flex items-center justify-between text-xs">
                <span class="text-gray-500">Complexity: {component.complexity}/5</span>
                <button class="text-blue-600 hover:text-blue-800 font-medium">
                  Add
                </button>
              </div>
              <div class="mt-2 flex flex-wrap gap-1">
                {component.tags.slice(0, 3).map((tag) => (
                  <span key={tag} class="text-xs bg-gray-100 text-gray-700 px-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderWiringTab = () => (
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">Circuit Wiring</h3>
        <button class="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
          Auto-Route
        </button>
      </div>

      <div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg h-96 flex items-center justify-center">
        {components.length === 0 ? (
          <div class="text-center text-gray-500">
            <p class="mb-2">No components added yet</p>
            <p class="text-sm">Add components from the Components tab to start wiring</p>
          </div>
        ) : (
          <div class="text-center text-gray-500">
            <p class="mb-2">Interactive Circuit Designer</p>
            <p class="text-sm">Drag and drop components to connect them</p>
          </div>
        )}
      </div>

      <div class="mt-4">
        <h4 class="font-medium mb-2">Connections ({connections.length})</h4>
        <div class="space-y-2 max-h-40 overflow-y-auto">
          {connections.map((connection) => (
            <div key={connection.id} class="flex items-center justify-between p-2 bg-white border rounded text-sm">
              <div class="flex items-center gap-2">
                <span class="text-gray-600">{connection.fromComponent}</span>
                <span class="text-gray-400">→</span>
                <span class="text-gray-600">{connection.toComponent}</span>
              </div>
              <span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {connection.wireType}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSimulationTab = () => (
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">Circuit Simulation</h3>
        <button
          onClick={handleRunSimulation}
          disabled={loading || components.length === 0}
          class="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? 'Running...' : 'Run Simulation'}
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <h4 class="font-medium">Input Controls</h4>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-2 bg-white border rounded">
              <span class="text-sm">Power Supply</span>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer" />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div class="flex items-center justify-between p-2 bg-white border rounded">
              <span class="text-sm">Signal Generator</span>
              <input type="range" min="0" max="100" class="w-24" />
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="font-medium">Output Readings</h4>
          <div class="space-y-2">
            <div class="flex justify-between p-2 bg-white border rounded">
              <span class="text-sm">Voltage</span>
              <span class="font-mono text-sm">5.0V</span>
            </div>
            <div class="flex justify-between p-2 bg-white border rounded">
              <span class="text-sm">Current</span>
              <span class="font-mono text-sm">0.02A</span>
            </div>
            <div class="flex justify-between p-2 bg-white border rounded">
              <span class="text-sm">Power</span>
              <span class="font-mono text-sm">0.1W</span>
            </div>
          </div>
        </div>
      </div>

      {simulationResult && (
        <div class="mt-6 p-4 bg-white border rounded-lg">
          <h4 class="font-medium mb-2">Simulation Results</h4>
          <pre class="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
            {JSON.stringify(simulationResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );

  const renderLearningTab = () => (
    <div class="space-y-6">
      <div>
        <h3 class="text-lg font-semibold mb-4">Learning Progress</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white p-4 border rounded-lg">
            <div class="text-2xl font-bold text-blue-600">{projectStats.progress}%</div>
            <div class="text-sm text-gray-600">Project Progress</div>
          </div>
          <div class="bg-white p-4 border rounded-lg">
            <div class="text-2xl font-bold text-green-600">{projectStats.completedChallenges}</div>
            <div class="text-sm text-gray-600">Challenges Completed</div>
          </div>
          <div class="bg-white p-4 border rounded-lg">
            <div class="text-2xl font-bold text-purple-600">{projectStats.totalPoints}</div>
            <div class="text-sm text-gray-600">Total Points</div>
          </div>
        </div>
      </div>

      <div>
        <h4 class="font-medium mb-3">Available Challenges</h4>
        <div class="space-y-3">
          <div class="p-4 bg-white border rounded-lg">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h5 class="font-medium">Blinking LED Challenge</h5>
                <p class="text-sm text-gray-600">Create a circuit that makes an LED blink</p>
              </div>
              <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                +100 pts
              </span>
            </div>
            <div class="flex justify-between items-center">
              <div class="flex gap-2">
                <button class="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                  Start Challenge
                </button>
                <button class="text-xs px-3 py-1 bg-gray-100 text-gray-800 rounded-full">
                  View Solution
                </button>
              </div>
              <span class="text-xs text-gray-500">Difficulty: 1/5</span>
            </div>
          </div>

          <div class="p-4 bg-white border rounded-lg">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h5 class="font-medium">Temperature Sensor Circuit</h5>
                <p class="text-sm text-gray-600">Build a circuit that measures temperature</p>
              </div>
              <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                +250 pts
              </span>
            </div>
            <div class="flex justify-between items-center">
              <div class="flex gap-2">
                <button class="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                  Start Challenge
                </button>
                <button class="text-xs px-3 py-1 bg-gray-100 text-gray-800 rounded-full">
                  View Solution
                </button>
              </div>
              <span class="text-xs text-gray-500">Difficulty: 3/5</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 class="font-medium mb-3">Learning Resources</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <a href="#" class="p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            <div class="text-blue-800 font-medium">📹 Basic Circuits Tutorial</div>
            <div class="text-sm text-blue-600">Learn the fundamentals of electronics</div>
          </a>
          <a href="#" class="p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
            <div class="text-green-800 font-medium">📚 Component Guide</div>
            <div class="text-sm text-green-600">Reference for common components</div>
          </a>
          <a href="#" class="p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
            <div class="text-purple-800 font-medium">🎓 Arduino Programming</div>
            <div class="text-sm text-purple-600">Start programming microcontrollers</div>
          </a>
          <a href="#" class="p-3 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
            <div class="text-orange-800 font-medium">🔧 Troubleshooting Guide</div>
            <div class="text-sm text-orange-600">Fix common circuit problems</div>
          </a>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'components':
        return renderComponentsTab();
      case 'wiring':
        return renderWiringTab();
      case 'simulation':
        return renderSimulationTab();
      case 'learning':
        return renderLearningTab();
      default:
        return renderComponentsTab();
    }
  };

  return (
    <div class="w-full h-full bg-white border rounded-lg">
      {/* Tab Navigation */}
      <div class="border-b">
        <nav class="flex">
          {[
            { id: 'components', label: 'Components', icon: '🧩' },
            { id: 'wiring', label: 'Wiring', icon: '🔌' },
            { id: 'simulation', label: 'Simulation', icon: '⚡' },
            { id: 'learning', label: 'Learning', icon: '📚' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              class={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div class="p-4 h-[calc(100%-3rem)] overflow-y-auto">
        {loading && (
          <div class="flex items-center justify-center h-64">
            <div class="text-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p class="text-gray-600">Loading STEM features...</p>
            </div>
          </div>
        )}
        {!loading && renderTabContent()}
      </div>
    </div>
  );
}