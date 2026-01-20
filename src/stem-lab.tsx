/**
 * STEM Learning Lab - Complete STEM Integration Interface
 *
 * Full-featured STEM environment integrated with Cocapn IDE
 */

import { h, JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export function STEMLab() {
  const [activeTab, setActiveTab] = useState<'designer' | 'components' | 'simulation' | 'learning'>('designer');
  const [projectData, setProjectData] = useState({
    name: 'My STEM Project',
    type: 'circuit',
    complexity: 2,
    components: [],
    connections: [],
    progress: 0
  });
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationResults, setSimulationResults] = useState<any>(null);

  useEffect(() => {
    loadProjectData();
  }, []);

  const loadProjectData = async () => {
    try {
      const response = await fetch('/api/stem/projects/current');
      const data = await response.json();
      setProjectData(data.project || projectData);
    } catch (error) {
      console.error('Error loading project data:', error);
    }
  };

  const runSimulation = async () => {
    setSimulationRunning(true);
    try {
      const response = await fetch('/api/stem/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });

      const results = await response.json();
      setSimulationResults(results);
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setSimulationRunning(false);
    }
  };

  const renderDesigner = () => (
    <div class="h-full flex">
      {/* Components palette */}
      <div class="w-64 border-r bg-gray-50 p-4 overflow-y-auto">
        <h3 class="font-semibold mb-4">Components</h3>
        <div class="space-y-2">
          {[
            { name: 'LED', category: 'Electronic', icon: '💡' },
            { name: 'Resistor', category: 'Electronic', icon: '⚡' },
            { name: 'Switch', category: 'Electronic', icon: '🔘' },
            { name: 'Capacitor', category: 'Electronic', icon: '🔋' },
            { name: 'Transistor', category: 'Electronic', icon: '📡' },
            { name: 'Sensor', category: 'Input', icon: '📊' },
            { name: 'Motor', category: 'Actuator', icon: '⚙️' },
            { name: 'Battery', category: 'Power', icon: '🔋' }
          ].map((component) => (
            <div
              key={component.name}
              class="flex items-center gap-2 p-2 bg-white rounded border hover:shadow cursor-pointer"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('component', JSON.stringify(component))}
            >
              <span class="text-lg">{component.icon}</span>
              <div>
                <div class="text-sm font-medium">{component.name}</div>
                <div class="text-xs text-gray-500">{component.category}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div class="flex-1 relative bg-white">
        <div class="absolute inset-0 border-2 border-dashed border-gray-300 flex items-center justify-center">
          <div class="text-center text-gray-500">
            <div class="text-4xl mb-2">🧩</div>
            <p class="text-lg font-medium">STEM Circuit Designer</p>
            <p class="text-sm">Drag components here to build your circuit</p>
            <div class="mt-4 text-xs text-gray-400">
              Components: {projectData.components.length} |
              Connections: {projectData.connections.length} |
              Progress: {projectData.progress}%
            </div>
          </div>
        </div>

        {/* Simulation controls */}
        <div class="absolute top-4 right-4 flex gap-2">
          <button
            onClick={runSimulation}
            disabled={simulationRunning || projectData.components.length === 0}
            class={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              simulationRunning || projectData.components.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {simulationRunning ? '⏳ Simulating...' : '▶️ Run Simulation'}
          </button>
          <button class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
            💾 Save
          </button>
        </div>
      </div>

      {/* Properties panel */}
      <div class="w-64 border-l bg-gray-50 p-4">
        <h3 class="font-semibold mb-4">Properties</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input
              type="text"
              value={projectData.name}
              onChange={(e) => setProjectData({...projectData, name: e.target.value})}
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={projectData.type}
              onChange={(e) => setProjectData({...projectData, type: e.target.value})}
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="circuit">Circuit</option>
              <option value="robotics">Robotics</option>
              <option value="iot">IoT Device</option>
              <option value="automation">Automation</option>
              <option value="game">Game</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Complexity</label>
            <input
              type="range"
              min="1"
              max="5"
              value={projectData.complexity}
              onChange={(e) => setProjectData({...projectData, complexity: parseInt(e.target.value)})}
              class="w-full"
            />
            <div class="text-xs text-gray-500">Level {projectData.complexity}/5</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSimulation = () => (
    <div class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white border rounded-lg p-4">
          <h4 class="font-medium mb-2">Voltage Readings</h4>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span>Input:</span>
              <span class="font-mono">5.0V</span>
            </div>
            <div class="flex justify-between">
              <span>Output:</span>
              <span class="font-mono">3.3V</span>
            </div>
            <div class="flex justify-between">
              <span>Drop:</span>
              <span class="font-mono">1.7V</span>
            </div>
          </div>
        </div>
        <div class="bg-white border rounded-lg p-4">
          <h4 class="font-medium mb-2">Current Flow</h4>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span>Total:</span>
              <span class="font-mono">0.020A</span>
            </div>
            <div class="flex justify-between">
              <span>LED:</span>
              <span class="font-mono">0.015A</span>
            </div>
            <div class="flex justify-between">
              <span>Resistor:</span>
              <span class="font-mono">0.005A</span>
            </div>
          </div>
        </div>
        <div class="bg-white border rounded-lg p-4">
          <h4 class="font-medium mb-2">Power Analysis</h4>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span>Consumed:</span>
              <span class="font-mono">0.100W</span>
            </div>
            <div class="flex justify-between">
              <span>Efficiency:</span>
              <span class="font-mono">85%</span>
            </div>
            <div class="flex justify-between">
              <span>Heat:</span>
              <span class="font-mono">Low</span>
            </div>
          </div>
        </div>
      </div>

      {simulationResults && (
        <div class="bg-white border rounded-lg p-4">
          <h4 class="font-medium mb-2">Simulation Results</h4>
          <pre class="text-xs bg-gray-50 p-3 rounded overflow-x-auto max-h-64">
            {JSON.stringify(simulationResults, null, 2)}
          </pre>
        </div>
      )}

      <div class="bg-white border rounded-lg p-4">
        <h4 class="font-medium mb-2">Educational Insights</h4>
        <div class="space-y-2 text-sm text-gray-700">
          <div class="flex items-start gap-2">
            <span class="text-blue-600">💡</span>
            <div>The voltage drop across the resistor follows Ohm's Law: V = IR</div>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-blue-600">💡</span>
            <div>The LED requires a current-limiting resistor to prevent damage</div>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-blue-600">💡</span>
            <div>Power dissipation in the resistor: P = I²R = 0.005² × 330 = 0.008W</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'designer':
        return renderDesigner();
      case 'components':
        return (
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">Component Library</h3>
            <p class="text-gray-600">Browse and manage STEM components. This would show a searchable library with filters and detailed information.</p>
          </div>
        );
      case 'simulation':
        return renderSimulation();
      case 'learning':
        return (
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">Learning Resources</h3>
            <p class="text-gray-600">Access tutorials, challenges, and educational content tailored to your current project.</p>
          </div>
        );
      default:
        return renderDesigner();
    }
  };

  return (
    <div class="h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header class="bg-white border-b px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="text-2xl">🧩</div>
            <div>
              <h1 class="text-xl font-bold">STEM Learning Lab</h1>
              <p class="text-sm text-gray-600">Interactive circuit design and learning platform</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-sm text-gray-600">
              Project: {projectData.name}
            </div>
            <button class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
              Export Project
            </button>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav class="bg-white border-b px-6">
        <div class="flex space-x-1">
          {[
            { id: 'designer', label: '🎨 Designer', icon: '🎨' },
            { id: 'components', label: '📦 Components', icon: '📦' },
            { id: 'simulation', label: '⚡ Simulation', icon: '⚡' },
            { id: 'learning', label: '📚 Learning', icon: '📚' }
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
        </div>
      </nav>

      {/* Main content */}
      <main class="flex-1 overflow-auto">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer class="bg-white border-t px-6 py-3">
        <div class="flex items-center justify-between text-sm text-gray-600">
          <div>STEM Learning Lab v1.0 • Integrated with Cocapn Hybrid IDE</div>
          <div class="flex items-center gap-4">
            <span>Components: {projectData.components.length}</span>
            <span>Connections: {projectData.connections.length}</span>
            <span>Progress: {projectData.progress}%</span>
          </div>
        </div>
      </footer>
    </div>
  );
}