# @claudeflare/xai - Explainable AI System

Comprehensive XAI (Explainable AI) system for ClaudeFlare, providing model interpretability, feature attribution, and explanation generation capabilities.

## Features

### Model-Agnostic Explanations
- **SHAP** (SHapley Additive exPlanations) - Game-theoretic feature attribution
- **LIME** (Local Interpretable Model-agnostic Explanations) - Local linear approximations
- **Permutation Importance** - Feature importance via permutation
- **Partial Dependence Plots** - Global feature relationships
- **Accumulated Local Effects** - Unbiased feature effects

### Model-Specific Explanations
- **Attention Visualization** - Transformer attention mechanisms
- **Gradient-based Saliency** - Input gradient attribution
- **Integrated Gradients** - Path-based attribution
- **Grad-CAM** - Gradient-weighted class activation
- **Neuron Activation** - Layer-wise activation analysis

### Counterfactual Explanations
- **What-if Analysis** - Scenario exploration
- **Minimal Changes** - Optimal counterfactual generation
- **Actionable Recommendations** - Practical suggestions
- **Sensitivity Analysis** - Robustness testing
- **Scenario Generation** - Multiple counterfactuals

### Natural Language Explanations
- **Text Generation** - Human-readable explanations
- **Rule Extraction** - Decision rule extraction
- **Decision Summarization** - Prediction explanation
- **Justification Generation** - Reason generation
- **Interactive Q&A** - Explanation dialogue

## Installation

```bash
npm install @claudeflare/xai
```

## Usage

### SHAP Explanations

```typescript
import { SHAPExplainer } from '@claudeflare/xai/shap';

const explainer = new SHAPExplainer({
  method: 'kernel',
  backgroundSize: 100
});

const explanation = await explainer.explain(model, instance);
console.log(explanation.featureValues);
```

### LIME Explanations

```typescript
import { LIMEExplainer } from '@claudeflare/xai/lime';

const explainer = new LIMEExplainer({
  numSamples: 5000,
  kernelWidth: 0.75
});

const explanation = await explainer.explain(model, instance);
console.log(explanation.localExplanation);
```

### Attention Visualization

```typescript
import { AttentionVisualizer } from '@claudeflare/xai/attention';

const visualizer = new AttentionVisualizer({
  layer: -1,
  head: 0
});

const visualization = await visualizer.visualize(
  model,
  inputTokens
);
```

### Counterfactual Explanations

```typescript
import { CounterfactualGenerator } from '@claudeflare/xai/counterfactual';

const generator = new CounterfactualGenerator({
  method: 'genetic',
  numCandidates: 10
});

const counterfactuals = await generator.generate(
  model,
  instance,
  targetClass
);
```

### Model Interpretation

```typescript
import { ModelInterpreter } from '@claudeflare/xai/interpretation';

const interpreter = new ModelInterpreter();

const report = await interpreter.interpret(model, {
  includeGlobal: true,
  includeLocal: true,
  includeAttention: true
});
```

### Explanation Reporting

```typescript
import { ExplanationReporter } from '@claudeflare/xai/reporting';

const reporter = new ExplanationReporter();

const report = await reporter.generateReport({
  shap: shapExplanation,
  lime: limeExplanation,
  attention: attentionVisualization
}, {
  format: 'html',
  includeVisualizations: true
});
```

## API Reference

### SHAP Methods

- `explain(instance)` - Generate SHAP values for an instance
- `explainBatch(instances)` - Generate SHAP values for multiple instances
- `featureImportance()` - Calculate global feature importance
- `interactionValues()` - Calculate feature interaction effects

### LIME Methods

- `explain(instance)` - Generate LIME explanation for an instance
- `explainBatch(instances)` - Generate explanations for multiple instances
- `featureImportance()` - Get local feature importance
- `decisionBoundary()` - Visualize local decision boundary

### Attention Methods

- `visualize(tokens)` - Visualize attention patterns
- `getAttentionWeights()` - Extract attention weight matrices
- `aggregateAttention()` - Aggregate multi-head attention
- `attentionFlow()` - Compute attention flow through layers

### Counterfactual Methods

- `generate(instance, target)` - Generate counterfactual examples
- `generateMultiple(instance, targets)` - Generate multiple counterfactuals
- `evaluate(counterfactual)` - Evaluate counterfactual quality
- `suggestActions(instance)` - Generate actionable recommendations

### Interpretation Methods

- `interpret(model, options)` - Generate comprehensive model interpretation
- `compare(instances)` - Compare predictions across instances
- `analyzeError(instance)` - Analyze prediction errors
- `summarize(explanations)` - Summarize multiple explanations

## Architecture

```
src/
├── shap/              # SHAP implementation
│   ├── kernel.ts      # Kernel SHAP
│   ├── tree.ts        # Tree SHAP
│   ├── deep.ts        # Deep SHAP
│   └── sampling.ts    # Sampling methods
├── lime/              # LIME implementation
│   ├── tabular.ts     # Tabular LIME
│   ├── text.ts        # Text LIME
│   ├── image.ts       # Image LIME
│   └── kernel.ts      # Kernel functions
├── attention/         # Attention visualization
│   ├── visualizer.ts  # Visualization logic
│   ├── weights.ts     # Weight extraction
│   ├── aggregation.ts # Multi-head aggregation
│   └── heatmap.ts     # Heatmap generation
├── interpretation/    # Model interpretation
│   ├── interpreter.ts # Main interpreter
│   ├── global.ts      # Global explanations
│   ├── local.ts       # Local explanations
│   └── comparison.ts  # Instance comparison
├── counterfactual/    # Counterfactual explanations
│   ├── generator.ts   # Counterfactual generation
│   ├── genetic.ts     # Genetic algorithm
│   ├── gradient.ts    # Gradient-based methods
│   └── evaluation.ts  # Quality metrics
├── reporting/         # Explanation reporting
│   ├── reporter.ts    # Report generation
│   ├── text.ts        # Text generation
│   ├── html.ts        # HTML reports
│   └── visualization.ts # Visualizations
├── types/             # Type definitions
│   ├── explanations.ts
│   ├── attention.ts
│   └── models.ts
└── utils/             # Utilities
    ├── math.ts        # Math utilities
    ├── visualization.ts
    └── validation.ts
```

## License

MIT
