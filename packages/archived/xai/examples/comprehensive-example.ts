/**
 * Comprehensive XAI System Example
 *
 * This example demonstrates the complete explainable AI workflow using
 * all components of the @claudeflare/xai package.
 */

import {
  KernelSHAP,
  TabularLIME,
  AttentionVisualizer,
  CounterfactualGenerator,
  ModelInterpreter,
  ExplanationReporter,
  type ModelMetadata,
} from '../src';

// ============================================================================
// Mock Model Implementation
// ============================================================================

class CreditScoringModel {
  async predict(input: Record<string, any>): Promise<number> {
    // Simplified credit scoring model
    const income = (input.income || 0) / 100000; // Normalize
    const age = (input.age || 0) / 100; // Normalize
    const debtToIncome = input.debtToIncome || 0;
    const creditHistory = input.creditHistory || 0; // 0-1 scale
    const employmentYears = (input.employmentYears || 0) / 40; // Normalize

    const score =
      income * 0.3 +
      age * 0.1 +
      (1 - debtToIncome) * 0.25 +
      creditHistory * 0.25 +
      employmentYears * 0.1;

    return Math.min(1, Math.max(0, score));
  }

  async predictBatch(inputs: Record<string, any>[]): Promise<number[]> {
    return Promise.all(inputs.map(i => this.predict(i)));
  }

  getMetadata(): ModelMetadata {
    return {
      modelInfo: {
        id: 'credit-scoring-model-v1',
        name: 'Credit Scoring Model',
        type: 'classification',
        version: '1.0.0',
        inputShape: [5],
        outputShape: [1],
        parameters: 1000,
        trainable: true,
      },
      featureNames: ['income', 'age', 'debtToIncome', 'creditHistory', 'employmentYears'],
      featureTypes: [
        { name: 'income', type: 'numeric', range: [20000, 200000], nullable: false },
        { name: 'age', type: 'numeric', range: [18, 80], nullable: false },
        { name: 'debtToIncome', type: 'numeric', range: [0, 1], nullable: false },
        { name: 'creditHistory', type: 'numeric', range: [0, 1], nullable: false },
        { name: 'employmentYears', type: 'numeric', range: [0, 40], nullable: false },
      ],
      hyperparameters: {
        learningRate: 0.001,
        epochs: 500,
        batchSize: 32,
      },
      performanceMetrics: {
        accuracy: 0.87,
        precision: 0.85,
        recall: 0.82,
        f1Score: 0.835,
        auc: 0.89,
      },
    };
  }
}

// ============================================================================
// Main Example Function
// ============================================================================

async function runComprehensiveXAIExample() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Comprehensive Explainable AI System Demo              ║');
  console.log('║     ClaudeFlare XAI Package v1.0.0                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Initialize model
  const model = new CreditScoringModel();
  const metadata = model.getMetadata();

  console.log('Model Information:');
  console.log(`  Name: ${metadata.modelInfo.name}`);
  console.log(`  Version: ${metadata.modelInfo.version}`);
  console.log(`  Features: ${metadata.featureNames.join(', ')}`);
  console.log(`  Accuracy: ${(metadata.performanceMetrics?.accuracy! * 100).toFixed(1)}%\n`);

  // Test instance
  const testInstance = {
    income: 75000,
    age: 35,
    debtToIncome: 0.3,
    creditHistory: 0.75,
    employmentYears: 8,
  };

  console.log('─'.repeat(60));
  console.log('Test Instance:');
  console.log(JSON.stringify(testInstance, null, 2));
  const prediction = await model.predict(testInstance);
  console.log(`\nPrediction: ${(prediction * 100).toFixed(1)}%`);
  console.log('─'.repeat(60) + '\n');

  // =========================================================================
  // 1. SHAP Explanation
  // =========================================================================

  console.log('1️⃣  SHAP (SHapley Additive exPlanations)\n');

  const shapExplainer = new KernelSHAP(metadata, {
    backgroundSize: 100,
    maxSamples: 1000,
    algorithm: 'auto',
  });

  const shapExplanation = await shapExplainer.explain(testInstance, async (samples) => {
    return model.predictBatch(samples);
  });

  console.log('SHAP Results:');
  console.log(`  Base Value: ${shapExplanation.expectedValue.toFixed(4)}`);
  console.log(`  Prediction: ${shapExplanation.prediction.toFixed(4)}`);
  console.log(`  Confidence: ${(shapExplanation.confidence * 100).toFixed(1)}%\n`);

  console.log('  Feature Contributions:');
  shapExplanation.features.slice(0, 5).forEach((feature, idx) => {
    const arrow = feature.direction === 'positive' ? '↑' : '↓';
    console.log(`    ${idx + 1}. ${arrow} ${feature.featureName.padEnd(20)}: ${feature.contribution.toFixed(4)} (${feature.description})`);
  });

  // =========================================================================
  // 2. LIME Explanation
  // =========================================================================

  console.log('\n2️⃣  LIME (Local Interpretable Model-agnostic Explanations)\n');

  const limeExplainer = new TabularLIME(metadata, {
    numSamples: 5000,
    kernelWidth: 0.75,
    mode: 'classification',
  });

  const limeExplanation = await limeExplainer.explain(testInstance, async (samples) => {
    return model.predictBatch(samples);
  });

  console.log('LIME Results:');
  console.log(`  Local R² Score: ${limeExplanation.score.toFixed(4)}`);
  console.log(`  Intercept: ${limeExplanation.intercept.toFixed(4)}`);
  console.log(`  Local Prediction: ${limeExplanation.predictionLocal.toFixed(4)}\n`);

  console.log('  Key Local Features:');
  limeExplanation.features.slice(0, 5).forEach((feature, idx) => {
    const arrow = feature.direction === 'positive' ? '↑' : '↓';
    console.log(`    ${idx + 1}. ${arrow} ${feature.featureName.padEnd(20)}: ${feature.contribution.toFixed(4)}`);
  });

  // =========================================================================
  // 3. Attention Visualization (simulated for non-transformer model)
  // =========================================================================

  console.log('\n3️⃣  Attention Visualization\n');
  console.log('  (Skipped - not applicable for non-transformer models)');
  console.log('  Use AttentionVisualizer for transformer-based models\n');

  // =========================================================================
  // 4. Counterfactual Explanations
  // =========================================================================

  console.log('4️⃣  Counterfactual Explanations\n');

  const cfGenerator = new CounterfactualGenerator(metadata, {
    method: 'genetic',
    numCandidates: 5,
    maxIterations: 500,
    distanceMetric: 'euclidean',
  });

  const targetScore = 0.9; // Target: 90% credit score
  const counterfactuals = await cfGenerator.generate(
    testInstance,
    prediction,
    targetScore,
    async (features) => model.predict(features)
  );

  if (counterfactuals.length > 0) {
    const bestCF = counterfactuals[0];
    console.log('Counterfactual Found:');
    console.log(`  Original Prediction: ${(bestCF.originalPrediction * 100).toFixed(1)}%`);
    console.log(`  Target Prediction: ${(bestCF.counterfactualPrediction * 100).toFixed(1)}%`);
    console.log(`  Proximity: ${(bestCF.proximity * 100).toFixed(1)}%`);
    console.log(`  Plausibility: ${(bestCF.plausibility * 100).toFixed(1)}%\n`);

    console.log('  Required Changes:');
    bestCF.changes.slice(0, 3).forEach((change) => {
      const action = change.direction === 'increase' ? 'Increase' : 'Decrease';
      console.log(`    • ${action} ${change.featureName}:`);
      console.log(`      ${change.originalValue.toFixed(2)} → ${change.counterfactualValue.toFixed(2)}`);
    });

    console.log('\n  Actionability:');
    console.log(`    Score: ${(bestCF.actionability.score * 100).toFixed(1)}%`);
    console.log(`    Complexity: ${bestCF.actionability.complexity}`);
    console.log(`    Time to Implement: ${bestCF.actionability.timeToImplement}`);
  } else {
    console.log('  No valid counterfactuals found within constraints.');
  }

  // =========================================================================
  // 5. Model Interpretation
  // =========================================================================

  console.log('\n5️⃣  Comprehensive Model Interpretation\n');

  const testInstances = [
    testInstance,
    { income: 45000, age: 28, debtToIncome: 0.5, creditHistory: 0.5, employmentYears: 3 },
    { income: 120000, age: 45, debtToIncome: 0.2, creditHistory: 0.9, employmentYears: 15 },
    { income: 35000, age: 25, debtToIncome: 0.7, creditHistory: 0.3, employmentYears: 1 },
  ];

  const interpreter = new ModelInterpreter(model);
  const interpretation = await interpreter.interpret(testInstances, {
    includeGlobal: true,
    includeLocal: true,
    includeBias: true,
    includeFairness: true,
  });

  if (interpretation.globalExplanation) {
    console.log('Global Feature Importance:');
    interpretation.globalExplanation.featureImportance.slice(0, 5).forEach((feature, idx) => {
      console.log(`  ${idx + 1}. ${feature.featureName.padEnd(20)}: ${feature.importance.toFixed(4)}`);
    });

    console.log('\nModel Behavior:');
    console.log(`  Accuracy: ${(interpretation.globalExplanation.modelBehavior.accuracy * 100).toFixed(1)}%`);
    console.log(`  F1 Score: ${interpretation.globalExplanation.modelBehavior.f1Score.toFixed(3)}`);
    console.log(`  Decision Boundary: ${interpretation.globalExplanation.modelBehavior.decisionBoundary.complexity}`);

    console.log('\nBias Analysis:');
    console.log(`  Bias Score: ${(interpretation.globalExplanation.modelBehavior.biasAnalysis.overallBiasScore * 100).toFixed(1)}%`);
    console.log(`  Issues Detected: ${interpretation.globalExplanation.modelBehavior.biasAnalysis.detectedBiases.length}`);

    console.log('\nFairness Metrics:');
    console.log(`  Overall Fairness: ${(interpretation.globalExplanation.modelBehavior.fairnessMetrics.overallFairness * 100).toFixed(1)}%`);
    console.log(`  Demographic Parity: ${(interpretation.globalExplanation.modelBehavior.fairnessMetrics.demographicParity * 100).toFixed(1)}%`);
  }

  // =========================================================================
  // 6. Explanation Report
  // =========================================================================

  console.log('\n6️⃣  Generating Explanation Report\n');

  const reporter = new ExplanationReporter();
  const report = await reporter.generateReport({
    shap: shapExplanation,
    lime: limeExplanation,
    global: interpretation.globalExplanation,
    local: interpretation.localExplanations,
  });

  console.log('Report Summary:');
  console.log(`  Report ID: ${report.id}`);
  console.log(`  Model: ${report.modelName}`);
  console.log(`  Confidence: ${(report.confidence * 100).toFixed(1)}%`);
  console.log(`  Completeness: ${(report.completeness * 100).toFixed(1)}%`);
  console.log(`  Visualizations: ${report.visualizations.length}`);
  console.log(`  Recommendations: ${report.recommendations.length}\n`);

  console.log('Recommendations:');
  report.recommendations.slice(0, 5).forEach((rec, idx) => {
    console.log(`  ${idx + 1}. ${rec}`);
  });

  // Export reports in different formats
  console.log('\n7️⃣  Exporting Reports\n');

  const htmlReport = await reporter.exportReport(report, 'html');
  const jsonReport = await reporter.exportReport(report, 'json');
  const markdownReport = await reporter.exportReport(report, 'markdown');

  console.log('Reports Generated:');
  console.log(`  ✓ HTML Report (${htmlReport.length} bytes)`);
  console.log(`  ✓ JSON Report (${jsonReport.length} bytes)`);
  console.log(`  ✓ Markdown Report (${markdownReport.length} bytes)`);

  // =========================================================================
  // 8. Natural Language Explanation
  // =========================================================================

  console.log('\n8️⃣  Natural Language Explanation\n');

  const nlExplanation = await reporter.generateNLExplanation(
    {
      shap: shapExplanation,
      global: interpretation.globalExplanation,
    },
    {
      tone: 'formal',
      length: 'medium',
      includeTechnicalDetails: true,
      includeExamples: true,
      includeCaveats: true,
    }
  );

  console.log('Generated Explanation:\n');
  console.log(nlExplanation.summary);
  console.log('\nKey Findings:');
  nlExplanation.keyFindings.forEach((finding) => {
    console.log(`  • ${finding}`);
  });

  // =========================================================================
  // Summary
  // =========================================================================

  console.log('\n' + '═'.repeat(60));
  console.log('📊 XAI Analysis Complete');
  console.log('═'.repeat(60));
  console.log('\nKey Insights:');
  console.log(`  • SHAP identified top contributing factors`);
  console.log(`  • LIME confirmed local feature importance`);
  console.log(`  • Counterfactuals provided actionable recommendations`);
  console.log(`  • Model interpretation revealed global patterns`);
  console.log(`  • Fairness analysis detected ${interpretation.globalExplanation?.modelBehavior.biasAnalysis.detectedBiases.length || 0} potential biases`);
  console.log('\nAll explanations successfully generated and exported!\n');
}

// Run the example
if (require.main === module) {
  runComprehensiveXAIExample()
    .then(() => {
      console.log('✅ Example completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Example failed:', error);
      process.exit(1);
    });
}

export { runComprehensiveXAIExample };
