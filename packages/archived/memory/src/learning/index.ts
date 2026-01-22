/**
 * Learning System Exports
 */

export {
  MemoryConsolidationSystem,
  D1ConsolidationStorage,
} from './consolidation';

export {
  MemoryPruningSystem,
  PruningScheduler,
  D1PruningStorage,
} from './pruning';

export {
  ExperienceReplaySystem,
  D1ExperienceStorage,
  D1PatternStorage,
} from './experience';

export type {
  ConsolidationConfig,
  ConsolidationStorage,
  MemoryAccessor,
} from './consolidation';

export type {
  PruningStorage,
} from './pruning';

export type {
  LearningConfig,
  ExperienceStorage,
  PatternStorage,
  TrainingResult,
  PatternLearningResult,
  MetaLearningResult,
  LearningProgress,
  LearningStats,
} from './experience';
