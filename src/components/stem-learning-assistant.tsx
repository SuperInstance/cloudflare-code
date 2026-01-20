/**
 * STEM Learning Assistant Component
 *
 * AI-powered educational assistant integrated with Cocapn IDE
 */

import { h, JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';

interface STEMAssistantProps {
  projectId: string;
  userLevel: 'beginner' | 'intermediate' | 'advanced';
  onEducationalContent?: (content: any) => void;
}

interface LearningContent {
  type: 'explanation' | 'challenge' | 'tutorial' | 'quiz';
  title: string;
  content: string;
  difficulty: number;
  estimatedTime: number;
  relatedConcepts: string[];
  interactive?: boolean;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  type: 'circuit' | 'code' | 'debug' | 'design';
  instructions: string[];
  expectedOutcome: string;
  hints: string[];
  points: number;
}

export function STEMLearningAssistant({ projectId, userLevel, onEducationalContent }: STEMAssistantProps) {
  const [activeView, setActiveView] = useState<'chat' | 'recommendations' | 'progress'>('chat');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recommendedContent, setRecommendedContent] = useState<LearningContent[]>([]);
  const [userProgress, setUserProgress] = useState({
    completedChallenges: 0,
    totalPoints: 0,
    currentLevel: 'beginner',
    achievements: ['First Circuit', 'LED Basics']
  });

  // Load initial recommendations
  useEffect(() => {
    loadRecommendations();
    loadUserProgress();
  }, [projectId, userLevel]);

  const loadRecommendations = async () => {
    try {
      const response = await fetch(`/api/stem/learning-paths?difficulty=${userLevel}`);
      const data = await response.json();

      // Transform learning paths to recommended content
      const content: LearningContent[] = data.learningPaths?.map((path: any) => ({
        type: 'tutorial' as const,
        title: path.title,
        content: path.description,
        difficulty: userLevel === 'beginner' ? 1 : userLevel === 'intermediate' ? 3 : 5,
        estimatedTime: path.estimatedTime,
        relatedConcepts: path.learningObjectives,
        interactive: true
      })) || [];

      setRecommendedContent(content);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const loadUserProgress = async () => {
    try {
      const response = await fetch(`/api/stem/progress?projectId=${projectId}`);
      const data = await response.json();
      setUserProgress(data.progress || userProgress);
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user' as const,
      content: inputMessage,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/stem/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          projectId,
          userLevel
        })
      });

      const data = await response.json();

      const assistantMessage = {
        role: 'assistant' as const,
        content: data.response || "I'm here to help you learn STEM concepts!",
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);
      onEducationalContent?.(data.educationalContent);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant' as const,
        content: "I'm having trouble responding right now. Please try again later.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startChallenge = async (challengeId: string) => {
    try {
      const response = await fetch(`/api/stem/challenges/${challengeId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });

      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message || 'Challenge started! Good luck!',
        timestamp: Date.now()
      }]);
    } catch (error) {
      console.error('Error starting challenge:', error);
    }
  };

  const renderChatView = () => (
    <div class="flex flex-col h-full">
      {/* Chat messages */}
      <div class="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg p-3 ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}>
              <div className="text-sm">{message.content}</div>
              <div className="text-xs opacity-70 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-4">
        <div class="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onInput={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about circuits, coding, or STEM concepts..."
            class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>

        {/* Quick suggestions */}
        <div class="mt-2 flex flex-wrap gap-2">
          {[
            'How do LEDs work?',
            'Explain Ohm\'s law',
            'Help me build a circuit',
            'What are resistors used for?'
          ].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setInputMessage(suggestion)}
              class="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRecommendationsView = () => (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">Recommended Learning</h3>
        <select class="text-sm border rounded-md px-2 py-1">
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendedContent.map((content, index) => (
          <div key={index} class="border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between mb-2">
              <h4 class="font-medium">{content.title}</h4>
              <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                {content.type}
              </span>
            </div>
            <p class="text-sm text-gray-600 mb-3 line-clamp-2">
              {content.content}
            </p>
            <div class="flex items-center justify-between text-xs">
              <span class="text-gray-500">⏱️ {content.estimatedTime} min</span>
              <span class="text-gray-500">🎯 Level {content.difficulty}</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-1">
              {content.relatedConcepts.slice(0, 3).map((concept, i) => (
                <span key={i} class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {concept}
                </span>
              ))}
            </div>
            <button class="mt-3 w-full px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">
              Start Learning
            </button>
          </div>
        ))}
      </div>

      {/* Challenges section */}
      <div class="mt-6">
        <h3 class="text-lg font-semibold mb-3">Challenges</h3>
        <div class="space-y-3">
          {[
            {
              id: 'challenge-1',
              title: 'Blinking LED Circuit',
              description: 'Create a circuit that makes an LED blink',
              difficulty: 1,
              points: 100,
              type: 'circuit'
            },
            {
              id: 'challenge-2',
              title: 'Temperature Monitor',
              description: 'Build a circuit that displays temperature',
              difficulty: 3,
              points: 250,
              type: 'circuit'
            }
          ].map((challenge) => (
            <div key={challenge.id} class="border rounded-lg p-4">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <h4 class="font-medium">{challenge.title}</h4>
                  <p class="text-sm text-gray-600">{challenge.description}</p>
                </div>
                <div class="text-right">
                  <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                    +{challenge.points} pts
                  </span>
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500">
                  Difficulty: {challenge.difficulty}/5 • Type: {challenge.type}
                </span>
                <button
                  onClick={() => startChallenge(challenge.id)}
                  class="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                >
                  Start Challenge
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderProgressView = () => (
    <div class="space-y-6">
      {/* Progress overview */}
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-blue-600">{userProgress.completedChallenges}</div>
          <div class="text-sm text-blue-800">Challenges Done</div>
        </div>
        <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-green-600">{userProgress.totalPoints}</div>
          <div class="text-sm text-green-800">Total Points</div>
        </div>
        <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-purple-600 capitalize">{userProgress.currentLevel}</div>
          <div class="text-sm text-purple-800">Current Level</div>
        </div>
        <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-orange-600">{userProgress.achievements.length}</div>
          <div class="text-sm text-orange-800">Achievements</div>
        </div>
      </div>

      {/* Achievements */}
      <div>
        <h3 class="text-lg font-semibold mb-3">Recent Achievements</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          {userProgress.achievements.map((achievement, index) => (
            <div key={index} class="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div class="text-2xl">🏆</div>
              <div>
                <div class="font-medium text-sm">{achievement}</div>
                <div class="text-xs text-gray-600">Unlocked recently</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Learning path progress */}
      <div>
        <h3 class="text-lg font-semibold mb-3">Learning Paths</h3>
        <div class="space-y-3">
          {[
            { name: 'Basic Circuits', progress: 75, total: 10 },
            { name: 'Arduino Programming', progress: 30, total: 15 },
            { name: 'Sensor Integration', progress: 10, total: 8 }
          ].map((path, index) => (
            <div key={index} class="border rounded-lg p-4">
              <div class="flex justify-between items-center mb-2">
                <h4 class="font-medium">{path.name}</h4>
                <span class="text-sm text-gray-600">{path.progress}/{path.total} completed</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(path.progress / path.total) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div class="w-full h-full bg-white border rounded-lg flex flex-col">
      {/* Header */}
      <div class="border-b p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <span>🎓</span>
            STEM Learning Assistant
          </h2>
          <div class="flex gap-1">
            {[
              { id: 'chat', label: '💬 Chat', icon: '💬' },
              { id: 'recommendations', label: '📚 Learn', icon: '📚' },
              { id: 'progress', label: '📊 Progress', icon: '📊' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                class={`px-3 py-1 text-sm rounded-md transition-colors ${
                  activeView === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div class="flex-1 overflow-y-auto p-4">
        {activeView === 'chat' && renderChatView()}
        {activeView === 'recommendations' && renderRecommendationsView()}
        {activeView === 'progress' && renderProgressView()}
      </div>
    </div>
  );
}