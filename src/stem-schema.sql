-- STEM Integration Database Schema
-- Extend existing Cocapn schema with STEM functionality

-- STEM Projects Table
CREATE TABLE IF NOT EXISTS stem_projects (
  id TEXT PRIMARY KEY,
  cocapn_project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('circuit', 'robotics', 'iot', 'automation', 'game')),
  complexity INTEGER NOT NULL CHECK (complexity BETWEEN 1 AND 5),
  educational_goals TEXT DEFAULT '[]', -- JSON array
  thumbnail TEXT,
  completed INTEGER DEFAULT 0 CHECK (completed IN (0, 1)),
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (cocapn_project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- STEM Components Library Table
CREATE TABLE IF NOT EXISTS stem_components (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('electronic', 'mechanical', 'software', 'sensor', 'actuator', 'control')),
  type TEXT NOT NULL,
  description TEXT,
  properties TEXT DEFAULT '{}', -- JSON object
  pins TEXT DEFAULT '[]', -- JSON array
  image_url TEXT,
  is_custom INTEGER DEFAULT 0 CHECK (is_custom IN (0, 1)),
  complexity INTEGER DEFAULT 1 CHECK (complexity BETWEEN 1 AND 5),
  tags TEXT DEFAULT '[]', -- JSON array
  educational_value TEXT DEFAULT '[]', -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- STEM Wiring Connections Table
CREATE TABLE IF NOT EXISTS stem_wiring_connections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  from_component_id TEXT NOT NULL,
  from_pin TEXT NOT NULL,
  to_component_id TEXT NOT NULL,
  to_pin TEXT NOT NULL,
  wire_type TEXT NOT NULL CHECK (wire_type IN ('digital', 'analog', 'power', 'ground')),
  color TEXT,
  thickness INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES stem_projects(id) ON DELETE CASCADE
);

-- STEM Code Snippets Table
CREATE TABLE IF NOT EXISTS stem_code_snippets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('typescript', 'javascript', 'python', 'arduino', 'microbit')),
  code TEXT NOT NULL,
  explanation TEXT,
  difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  generated_by TEXT NOT NULL CHECK (generated_by IN ('ai', 'manual')),
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES stem_projects(id) ON DELETE CASCADE
);

-- Learning Paths Table
CREATE TABLE IF NOT EXISTS stem_learning_paths (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_audience TEXT NOT NULL CHECK (target_audience IN ('beginner', 'intermediate', 'advanced')),
  estimated_time INTEGER NOT NULL, -- in minutes
  prerequisites TEXT DEFAULT '[]', -- JSON array
  learning_objectives TEXT DEFAULT '[]', -- JSON array
  resources TEXT DEFAULT '[]', -- JSON array of resources
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Challenge Table
CREATE TABLE IF NOT EXISTS stem_challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  type TEXT NOT NULL CHECK (type IN ('circuit', 'code', 'debug', 'design')),
  instructions TEXT DEFAULT '[]', -- JSON array
  expected_outcome TEXT,
  hints TEXT DEFAULT '[]', -- JSON array
  solution TEXT,
  learning_outcomes TEXT DEFAULT '[]', -- JSON array
  points INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- STEM Project Components Junction Table
CREATE TABLE IF NOT EXISTS stem_project_components (
  project_id TEXT NOT NULL,
  component_id TEXT NOT NULL,
  x_position REAL DEFAULT 0,
  y_position REAL DEFAULT 0,
  rotation REAL DEFAULT 0,
  scale REAL DEFAULT 1,
  properties TEXT DEFAULT '{}', -- JSON object for component-specific properties
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, component_id),
  FOREIGN KEY (project_id) REFERENCES stem_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (component_id) REFERENCES stem_components(id)
);

-- STEM Progress Tracking Table
CREATE TABLE IF NOT EXISTS stem_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  challenge_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('start', 'complete', 'skip', 'hint', 'error')),
  details TEXT DEFAULT '{}', -- JSON object with action details
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES stem_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (challenge_id) REFERENCES stem_challenges(id) ON DELETE CASCADE
);

-- STEM User Preferences Table
CREATE TABLE IF NOT EXISTS stem_user_preferences (
  user_id TEXT PRIMARY KEY,
  preferred_language TEXT DEFAULT 'typescript',
  ai_model_preference TEXT DEFAULT 'educational',
  simulation_enabled INTEGER DEFAULT 1 CHECK (simulation_enabled IN (0, 1)),
  auto_code_generation INTEGER DEFAULT 1 CHECK (auto_code_generation IN (0, 1)),
  complexity_preference INTEGER DEFAULT 3 CHECK (complexity_preference BETWEEN 1 AND 5),
  theme_preference TEXT DEFAULT 'light',
  updated_at INTEGER NOT NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stem_projects_cocapn_id ON stem_projects(cocapn_project_id);
CREATE INDEX IF NOT EXISTS idx_stem_projects_type ON stem_projects(type);
CREATE INDEX IF NOT EXISTS idx_stem_projects_complexity ON stem_projects(complexity);
CREATE INDEX IF NOT EXISTS idx_stem_projects_completed ON stem_projects(completed);

CREATE INDEX IF NOT EXISTS idx_stem_components_category ON stem_components(category);
CREATE INDEX IF NOT EXISTS idx_stem_components_type ON stem_components(type);
CREATE INDEX IF NOT EXISTS idx_stem_components_complexity ON stem_components(complexity);
CREATE INDEX IF NOT EXISTS idx_stem_components_is_custom ON stem_components(is_custom);

CREATE INDEX IF NOT EXISTS idx_stem_wiring_connections_project ON stem_wiring_connections(project_id);
CREATE INDEX IF NOT EXISTS idx_stem_wiring_connections_from_component ON stem_wiring_connections(from_component_id);
CREATE INDEX IF NOT EXISTS idx_stem_wiring_connections_to_component ON stem_wiring_connections(to_component_id);

CREATE INDEX IF NOT EXISTS idx_stem_code_snippets_project ON stem_code_snippets(project_id);
CREATE INDEX IF NOT EXISTS idx_stem_code_snippets_language ON stem_code_snippets(language);

CREATE INDEX IF NOT EXISTS idx_stem_progress_user_project ON stem_progress(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_stem_progress_timestamp ON stem_progress(timestamp);

CREATE INDEX IF NOT EXISTS idx_stem_challenges_difficulty ON stem_challenges(difficulty);
CREATE INDEX IF NOT EXISTS idx_stem_challenges_type ON stem_challenges(type);

CREATE INDEX IF NOT EXISTS idx_stem_user_preferences_user ON stem_user_preferences(user_id);

-- Triggers for automatic timestamps
CREATE TRIGGER IF NOT EXISTS update_stem_projects_updated_at
  AFTER UPDATE ON stem_projects
  FOR EACH ROW
  BEGIN
    UPDATE stem_projects SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_stem_components_updated_at
  AFTER UPDATE ON stem_components
  FOR EACH ROW
  BEGIN
    UPDATE stem_components SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_stem_learning_paths_updated_at
  AFTER UPDATE ON stem_learning_paths
  FOR EACH ROW
  BEGIN
    UPDATE stem_learning_paths SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_stem_user_preferences_updated_at
  AFTER UPDATE ON stem_user_preferences
  FOR EACH ROW
  BEGIN
    UPDATE stem_user_preferences SET updated_at = strftime('%s', 'now') * 1000 WHERE user_id = NEW.user_id;
  END;