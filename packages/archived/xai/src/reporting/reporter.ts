/**
 * Explanation Reporting
 * Generate comprehensive reports from explanations
 */

import {
  ExplanationReport,
  LocalExplanation,
  GlobalExplanation,
  VisualizationData,
  ReportConfig,
  SHAPExplanation,
  LIMEExplanation,
  AttentionVisualization,
  NLExplanation,
  ExplanationStyle,
} from '../types/explanations';
import { mean, stdDev } from '../utils/math';

export interface ReportData {
  shap?: SHAPExplanation;
  lime?: LIMEExplanation;
  attention?: AttentionVisualization;
  global?: GlobalExplanation;
  local?: LocalExplanation[];
}

export class ExplanationReporter {
  /**
   * Generate comprehensive explanation report
   */
  async generateReport(
    data: ReportData,
    config: ReportConfig = {}
  ): Promise<ExplanationReport> {
    const cfg: Required<ReportConfig> = {
      format: config.format ?? 'html',
      includeVisualizations: config.includeVisualizations ?? true,
      detailLevel: config.detailLevel ?? 'standard',
      targetAudience: config.targetAudience ?? 'both',
      language: config.language ?? 'en',
    };

    const localExplanations = data.local || [data.shap, data.lime].filter((e): e is LocalExplanation => e !== undefined && e !== null);

    const summary = this.generateSummary(data, cfg);
    const visualizations = cfg.includeVisualizations
      ? this.generateVisualizations(data)
      : [];
    const recommendations = this.generateRecommendations(data, cfg);

    const report: ExplanationReport = {
      id: this.generateId(),
      timestamp: new Date(),
      modelId: data.shap?.modelId || data.lime?.modelId || 'unknown',
      modelName: data.shap?.modelName || data.lime?.modelName || 'unknown',
      summary,
      localExplanations,
      globalExplanation: data.global,
      visualizations,
      recommendations,
      confidence: this.calculateOverallConfidence(localExplanations),
      completeness: this.calculateCompleteness(data),
    };

    return report;
  }

  /**
   * Generate summary text
   */
  private generateSummary(data: ReportData, config: Required<ReportConfig>): string {
    const parts: string[] = [];

    // Model information
    const modelName = data.shap?.modelName || data.lime?.modelName || 'the model';
    parts.push(`This report explains predictions made by ${modelName}.`);

    // SHAP summary
    if (data.shap) {
      parts.push(this.generateSHAPSummary(data.shap, config));
    }

    // LIME summary
    if (data.lime) {
      parts.push(this.generateLIMESummary(data.lime, config));
    }

    // Attention summary
    if (data.attention) {
      parts.push(this.generateAttentionSummary(data.attention, config));
    }

    // Global explanation summary
    if (data.global) {
      parts.push(this.generateGlobalSummary(data.global, config));
    }

    return parts.join('\n\n');
  }

  /**
   * Generate SHAP summary
   */
  private generateSHAPSummary(explanation: SHAPExplanation, config: Required<ReportConfig>): string {
    const parts: string[] = [];

    parts.push('SHAP Analysis:');
    parts.push(`- Base value: ${explanation.expectedValue.toFixed(4)}`);
    parts.push(`- Prediction: ${explanation.prediction}`);

    const topFeatures = explanation.features.slice(0, 5);
    parts.push(`- Top contributing features:`);
    for (const feature of topFeatures) {
      parts.push(`  * ${feature.description}`);
    }

    return parts.join('\n');
  }

  /**
   * Generate LIME summary
   */
  private generateLIMESummary(explanation: LIMEExplanation, config: Required<ReportConfig>): string {
    const parts: string[] = [];

    parts.push('LIME Analysis:');
    parts.push(`- Local model R² score: ${explanation.score.toFixed(4)}`);
    parts.push(`- Intercept: ${explanation.intercept.toFixed(4)}`);
    parts.push(`- Local prediction: ${explanation.predictionLocal.toFixed(4)}`);

    const topFeatures = explanation.features.slice(0, 5);
    parts.push(`- Key local features:`);
    for (const feature of topFeatures) {
      parts.push(`  * ${feature.description}`);
    }

    return parts.join('\n');
  }

  /**
   * Generate attention summary
   */
  private generateAttentionSummary(
    visualization: AttentionVisualization,
    config: Required<ReportConfig>
  ): string {
    const parts: string[] = [];

    parts.push(`Attention Analysis (Layer ${visualization.layer}, Head ${visualization.head}):`);

    parts.push(`- Identified patterns:`);
    for (const pattern of visualization.patterns) {
      parts.push(`  * ${pattern.description} (strength: ${pattern.strength.toFixed(2)})`);
    }

    return parts.join('\n');
  }

  /**
   * Generate global explanation summary
   */
  private generateGlobalSummary(
    explanation: GlobalExplanation,
    config: Required<ReportConfig>
  ): string {
    const parts: string[] = [];

    parts.push('Global Model Behavior:');
    parts.push(`- Accuracy: ${(explanation.modelBehavior.accuracy * 100).toFixed(1)}%`);
    parts.push(`- F1 Score: ${explanation.modelBehavior.f1Score.toFixed(3)}`);

    parts.push(`- Top features:`);
    for (const feature of explanation.featureImportance.slice(0, 5)) {
      parts.push(`  * ${feature.rank}. ${feature.featureName}: ${feature.importance.toFixed(4)}`);
    }

    if (explanation.modelBehavior.biasAnalysis.detectedBiases.length > 0) {
      parts.push(`- Bias detected: ${explanation.modelBehavior.biasAnalysis.detectedBiases.length} issues`);
    }

    return parts.join('\n');
  }

  /**
   * Generate visualizations
   */
  private generateVisualizations(data: ReportData): VisualizationData[] {
    const visualizations: VisualizationData[] = [];

    // SHAP waterfall plot
    if (data.shap) {
      visualizations.push({
        type: 'waterfall',
        data: {
          base: data.shap.shapValues.baseValue,
          features: data.shap.features.map(f => ({
            name: f.featureName,
            value: f.featureValue,
            contribution: f.contribution,
          })),
          final: data.shap.prediction,
        },
        metadata: {
          title: 'SHAP Feature Contributions',
          description: 'Waterfall plot showing how each feature contributes to the prediction',
        },
      });
    }

    // Feature importance bar chart
    if (data.global) {
      visualizations.push({
        type: 'bar',
        data: {
          labels: data.global.featureImportance.map(f => f.featureName),
          values: data.global.featureImportance.map(f => f.importance),
        },
        metadata: {
          title: 'Global Feature Importance',
          description: 'Overall importance of each feature for model predictions',
        },
      });
    }

    // Attention heatmap
    if (data.attention) {
      visualizations.push({
        type: 'heatmap',
        data: data.attention.heatmap,
        metadata: {
          title: `Attention Heatmap (Layer ${data.attention.layer}, Head ${data.attention.head})`,
          description: 'Visualization of attention weights between tokens',
        },
      });
    }

    return visualizations;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(data: ReportData, config: Required<ReportConfig>): string[] {
    const recommendations: string[] = [];

    // Global recommendations
    if (data.global) {
      recommendations.push(...data.global.recommendations);
    }

    // Bias recommendations
    if (data.global?.modelBehavior.biasAnalysis?.recommendations) {
      recommendations.push(...data.global.modelBehavior.biasAnalysis.recommendations);
    }

    // SHAP-based recommendations
    if (data.shap) {
      const lowImportanceFeatures = data.shap.features
        .filter(f => f.importance < 0.01)
        .slice(0, 3);

      if (lowImportanceFeatures.length > 0) {
        recommendations.push(
          `Consider removing low-importance features: ${lowImportanceFeatures.map(f => f.featureName).join(', ')}`
        );
      }
    }

    return recommendations;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(explanations: LocalExplanation[]): number {
    if (explanations.length === 0) return 0.5;

    const confidences = explanations.map(e => e.confidence);
    return mean(confidences);
  }

  /**
   * Calculate completeness score
   */
  private calculateCompleteness(data: ReportData): number {
    let score = 0;
    let maxScore = 0;

    if (data.shap) { score += 1; maxScore += 1; }
    if (data.lime) { score += 1; maxScore += 1; }
    if (data.attention) { score += 1; maxScore += 1; }
    if (data.global) { score += 2; maxScore += 2; }
    if (data.local && data.local.length > 0) { score += 1; maxScore += 1; }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Generate natural language explanation
   */
  async generateNLExplanation(
    data: ReportData,
    style: ExplanationStyle = {
      tone: 'formal',
      length: 'medium',
      includeTechnicalDetails: true,
      includeExamples: false,
      includeCaveats: true,
    }
  ): Promise<NLExplanation> {
    const explanation: NLExplanation = {
      summary: this.generateNLSummary(data, style),
      detailedExplanation: this.generateNLDetailed(data, style),
      keyFindings: this.generateKeyFindings(data, style),
      confidence: this.calculateOverallConfidence(data.local || []),
      recommendations: this.generateRecommendations(data, { format: 'text' } as Required<ReportConfig>),
      questions: [],
    };

    return explanation;
  }

  /**
   * Generate natural language summary
   */
  private generateNLSummary(data: ReportData, style: ExplanationStyle): string {
    const tone = style.tone === 'casual' ? "Here's what's going on:" : 'Summary:';

    let summary = `${tone} `;

    if (data.shap) {
      const pred = data.shap.prediction;
      summary += `The model predicts ${typeof pred === 'number' ? pred.toFixed(2) : pred}. `;
    }

    if (data.global) {
      const topFeature = data.global.featureImportance[0];
      summary += `${topFeature.featureName} is the most important feature. `;
    }

    return summary;
  }

  /**
   * Generate detailed natural language explanation
   */
  private generateNLDetailed(data: ReportData, style: ExplanationStyle): string {
    let detailed = '';

    if (data.shap && style.includeTechnicalDetails) {
      detailed += 'SHAP Analysis:\n';
      detailed += `The prediction starts from a base value of ${data.shap.expectedValue.toFixed(4)}. `;

      for (const feature of data.shap.features.slice(0, 5)) {
        detailed += `${feature.featureName} ${feature.direction === 'positive' ? 'increases' : 'decreases'} the prediction by ${Math.abs(feature.contribution).toFixed(4)}. `;
      }
    }

    if (data.global && style.includeTechnicalDetails) {
      detailed += '\n\nModel Performance:\n';
      detailed += `The model achieves ${data.global.modelBehavior.accuracy.toFixed(1)}% accuracy. `;

      if (data.global.modelBehavior.biasAnalysis.detectedBiases.length > 0) {
        detailed += `However, ${data.global.modelBehavior.biasAnalysis.detectedBiases.length} potential biases were detected. `;
      }
    }

    if (style.includeCaveats) {
      detailed += '\n\nLimitations:\n';
      detailed += 'This explanation is based on local approximations and may not capture all model behaviors. ';
      detailed += 'Feature importance can vary depending on the specific instance being analyzed. ';
    }

    return detailed;
  }

  /**
   * Generate key findings
   */
  private generateKeyFindings(data: ReportData, style: ExplanationStyle): string[] {
    const findings: string[] = [];

    if (data.shap) {
      const topFeature = data.shap.features[0];
      findings.push(`${topFeature.featureName} has the highest impact on this prediction`);

      const positiveCount = data.shap.features.filter(f => f.direction === 'positive').length;
      const negativeCount = data.shap.features.filter(f => f.direction === 'negative').length;

      findings.push(`${positiveCount} features increase the prediction, ${negativeCount} decrease it`);
    }

    if (data.global) {
      findings.push(`Top 3 features account for ${this.calculateTopFeatureContribution(data.global).toFixed(1)}% of overall importance`);
    }

    if (data.global?.modelBehavior.biasAnalysis.overallBiasScore > 0.5) {
      findings.push('Model shows signs of bias that should be investigated');
    }

    return findings;
  }

  /**
   * Calculate top feature contribution
   */
  private calculateTopFeatureContribution(global: GlobalExplanation): number {
    const totalImportance = global.featureImportance.reduce((sum, f) => sum + f.importance, 0);
    const top3Importance = global.featureImportance.slice(0, 3).reduce((sum, f) => sum + f.importance, 0);

    return totalImportance > 0 ? (top3Importance / totalImportance) * 100 : 0;
  }

  /**
   * Export report in different formats
   */
  async exportReport(
    report: ExplanationReport,
    format: 'html' | 'json' | 'markdown' | 'text'
  ): Promise<string> {
    switch (format) {
      case 'html':
        return this.exportToHTML(report);
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'markdown':
        return this.exportToMarkdown(report);
      case 'text':
        return this.exportToText(report);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export report to HTML
   */
  private exportToHTML(report: ExplanationReport): string {
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Model Explanation Report - ${report.modelName}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .recommendations { background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .confidence { font-size: 1.2em; font-weight: bold; color: #007bff; }
    .feature-list { list-style: none; padding: 0; }
    .feature-list li { padding: 10px; margin: 5px 0; background: #fff; border-left: 3px solid #007bff; }
  </style>
</head>
<body>
  <h1>Model Explanation Report</h1>
  <p><strong>Model:</strong> ${report.modelName}</p>
  <p><strong>Date:</strong> ${report.timestamp.toISOString()}</p>
  <p><strong>Overall Confidence:</strong> <span class="confidence">${(report.confidence * 100).toFixed(1)}%</span></p>

  <div class="summary">
    <h2>Summary</h2>
    <p>${this.escapeHTML(report.summary)}</p>
  </div>
`;

    if (report.globalExplanation) {
      html += `
  <h2>Global Feature Importance</h2>
  <ul class="feature-list">
`;
      for (const feature of report.globalExplanation.featureImportance.slice(0, 10)) {
        html += `    <li><strong>${feature.rank}. ${this.escapeHTML(feature.featureName)}:</strong> ${feature.importance.toFixed(4)}</li>\n`;
      }
      html += '  </ul>\n';
    }

    if (report.recommendations.length > 0) {
      html += `
  <div class="recommendations">
    <h2>Recommendations</h2>
    <ul>
`;
      for (const rec of report.recommendations) {
        html += `      <li>${this.escapeHTML(rec)}</li>\n`;
      }
      html += '    </ul>\n  </div>\n';
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Export report to Markdown
   */
  private exportToMarkdown(report: ExplanationReport): string {
    let md = `# Model Explanation Report\n\n`;
    md += `**Model:** ${report.modelName}\n\n`;
    md += `**Date:** ${report.timestamp.toISOString()}\n\n`;
    md += `**Overall Confidence:** ${(report.confidence * 100).toFixed(1)}%\n\n`;

    md += `## Summary\n\n${report.summary}\n\n`;

    if (report.globalExplanation) {
      md += `## Global Feature Importance\n\n`;
      for (const feature of report.globalExplanation.featureImportance.slice(0, 10)) {
        md += `${feature.rank}. **${feature.featureName}**: ${feature.importance.toFixed(4)}\n`;
      }
      md += '\n';
    }

    if (report.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      for (const rec of report.recommendations) {
        md += `- ${rec}\n`;
      }
      md += '\n';
    }

    return md;
  }

  /**
   * Export report to plain text
   */
  private exportToText(report: ExplanationReport): string {
    let text = `MODEL EXPLANATION REPORT\n`;
    text += `========================\n\n`;
    text += `Model: ${report.modelName}\n`;
    text += `Date: ${report.timestamp.toISOString()}\n`;
    text += `Overall Confidence: ${(report.confidence * 100).toFixed(1)}%\n\n`;

    text += `SUMMARY\n`;
    text += `-------\n${report.summary}\n\n`;

    if (report.globalExplanation) {
      text += `GLOBAL FEATURE IMPORTANCE\n`;
      text += `------------------------\n`;
      for (const feature of report.globalExplanation.featureImportance.slice(0, 10)) {
        text += `${feature.rank}. ${feature.featureName}: ${feature.importance.toFixed(4)}\n`;
      }
      text += '\n';
    }

    if (report.recommendations.length > 0) {
      text += `RECOMMENDATIONS\n`;
      text += `---------------\n`;
      for (const rec of report.recommendations) {
        text += `- ${rec}\n`;
      }
      text += '\n';
    }

    return text;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Compare multiple explanations
   */
  compareExplanations(reports: ExplanationReport[]): any {
    if (reports.length < 2) {
      throw new Error('Need at least 2 reports to compare');
    }

    const comparison: any = {
      models: reports.map(r => r.modelName),
      confidences: reports.map(r => r.confidence),
      completeness: reports.map(r => r.completeness),
    };

    // Compare feature importance if available
    const hasGlobalFeatures = reports.every(r => r.globalExplanation?.featureImportance);

    if (hasGlobalFeatures) {
      comparison.featureCorrelation = this.calculateFeatureImportanceCorrelation(reports);
    }

    return comparison;
  }

  /**
   * Calculate correlation of feature importance across reports
   */
  private calculateFeatureImportanceCorrelation(reports: ExplanationReport[]): number {
    // Simplified correlation calculation
    const allFeatures = new Set<string>();

    for (const report of reports) {
      if (report.globalExplanation) {
        for (const feature of report.globalExplanation.featureImportance) {
          allFeatures.add(feature.featureName);
        }
      }
    }

    let totalCorrelation = 0;
    let numComparisons = 0;

    for (let i = 0; i < reports.length; i++) {
      for (let j = i + 1; j < reports.length; j++) {
        const featuresA = reports[i].globalExplanation?.featureImportance || [];
        const featuresB = reports[j].globalExplanation?.featureImportance || [];

        const correlation = this.calculateRankCorrelation(featuresA, featuresB);
        totalCorrelation += correlation;
        numComparisons++;
      }
    }

    return numComparisons > 0 ? totalCorrelation / numComparisons : 0;
  }

  /**
   * Calculate rank correlation
   */
  private calculateRankCorrelation(
    featuresA: any[],
    featuresB: any[]
  ): number {
    // Simplified rank correlation
    const rankA = new Map(featuresA.map((f, i) => [f.featureName, i]));
    const rankB = new Map(featuresB.map((f, i) => [f.featureName, i]));

    const commonFeatures = Array.from(rankA.keys()).filter(f => rankB.has(f));

    if (commonFeatures.length === 0) return 0;

    let sumSquaredDiff = 0;
    for (const feature of commonFeatures) {
      const diff = (rankA.get(feature) || 0) - (rankB.get(feature) || 0);
      sumSquaredDiff += diff * diff;
    }

    const n = commonFeatures.length;
    const maxSum = n * (n * n - 1) / 3;

    return maxSum > 0 ? 1 - sumSquaredDiff / maxSum : 0;
  }
}
