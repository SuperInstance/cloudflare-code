/**
 * Comprehensive Multimodal AI Example
 * Demonstrates all features of the @claudeflare/multimodal package
 */

import {
  // Vision features
  analyzeImage,
  analyzeScreenshot,
  analyzeErrorScreenshot,
  analyzeUIMockup,
  analyzeAccessibility,
  extractCodeFromImage,
  extractCodeFromWhiteboard,
  analyzeDiagram,
  analyzeArchitectureDiagram,
  debugVisualIssue,
  compareScreenshots,

  // OCR features
  recognizeText,
  recognizeTextByLines,
  recognizeCode,
  validateOCRQuality,

  // Multimodal RAG
  storeDocument,
  search,
  searchByText,
  searchByImage,
  hybridSearch,

  // Utilities
  isValidImage,
  detectImageFormat,
  cosineSimilarity,
  validateEmbedding
} from '../src';

// ============================================================================
// Example 1: Screenshot Analysis
// ============================================================================

async function example1_ScreenshotAnalysis() {
  console.log('=== Example 1: Screenshot Analysis ===\n');

  // Load a screenshot (in real usage, this would be from a file)
  const screenshot = Buffer.from('screenshot-data');

  // Analyze the screenshot
  const result = await analyzeScreenshot(screenshot);

  console.log('Description:', result.description);
  console.log('UI Elements found:', result.uiElements?.length || 0);

  if (result.uiElements) {
    for (const element of result.uiElements) {
      console.log(`  - ${element.type}: ${element.label || 'No label'} (${Math.round(element.confidence * 100)}% confidence)`);
    }
  }

  console.log('Colors detected:', result.colors?.primary.length || 0);
  console.log('Processing time:', result.metadata.processingTime, 'ms');
}

// ============================================================================
// Example 2: Code Extraction from Screenshot
// ============================================================================

async function example2_CodeExtraction() {
  console.log('\n=== Example 2: Code Extraction ===\n');

  // Load code screenshot
  const codeScreenshot = Buffer.from('code-screenshot-data');

  // Extract code with OCR enhancement
  const code = await extractCodeFromImage({
    image: codeScreenshot,
    language: 'typescript',
    ocrEnhancement: true,
    preserveFormatting: true,
    includeLineNumbers: true
  });

  console.log('Detected language:', code.language);
  console.log('Confidence:', Math.round(code.confidence * 100) + '%');
  console.log('Extracted code:');
  console.log(code.code);
  console.log('\nDetected elements:', code.metadata.detectedElements.length);
}

// ============================================================================
// Example 3: Whiteboard Code Capture
// ============================================================================

async function example3_WhiteboardCapture() {
  console.log('\n=== Example 3: Whiteboard Code Capture ===\n');

  // Load whiteboard photo
  const whiteboardPhoto = Buffer.from('whiteboard-data');

  // Extract code from whiteboard
  const code = await extractCodeFromWhiteboard(whiteboardPhoto);

  console.log('Extracted from whiteboard:');
  console.log(code.code);
  console.log('\nConfidence:', Math.round(code.confidence * 100) + '%');
}

// ============================================================================
// Example 4: Diagram Analysis and Code Generation
// ============================================================================

async function example4_DiagramAnalysis() {
  console.log('\n=== Example 4: Diagram Analysis ===\n');

  // Load architecture diagram
  const diagram = Buffer.from('architecture-diagram-data');

  // Analyze diagram and generate code
  const result = await analyzeArchitectureDiagram(diagram);

  console.log('Diagram type:', result.type);
  console.log('Components found:', result.components.length);
  console.log('Connections found:', result.connections.length);

  for (const component of result.components) {
    console.log(`  - ${component.label} (${component.type})`);
  }

  if (result.code) {
    console.log('\nGenerated code:');
    console.log(result.code.code);
    console.log('\nDependencies:', result.code.dependencies.join(', '));
  }
}

// ============================================================================
// Example 5: Flowchart to Code
// ============================================================================

async function example5_FlowchartToCode() {
  console.log('\n=== Example 5: Flowchart to Code ===\n');

  // Load flowchart
  const flowchart = Buffer.from('flowchart-data');

  // Analyze and generate code
  const result = await analyzeDiagram({
    image: flowchart,
    type: 'flowchart',
    generateCode: true,
    targetLanguage: 'python'
  });

  console.log('Flowchart description:', result.description);

  if (result.code) {
    console.log('\nGenerated Python code:');
    console.log(result.code.code);
  }
}

// ============================================================================
// Example 6: Error Screenshot Debugging
// ============================================================================

async function example6_ErrorDebugging() {
  console.log('\n=== Example 6: Error Screenshot Debugging ===\n');

  // Load error screenshot
  const errorScreenshot = Buffer.from('error-screenshot-data');

  // Analyze error
  const result = await analyzeErrorScreenshot(errorScreenshot, 'User clicked submit button');

  console.log('Issues found:', result.errors?.length || 0);

  if (result.errors) {
    for (const error of result.errors) {
      console.log(`\nError: ${error.type}`);
      console.log(`Message: ${error.message}`);
      console.log(`Suggestions:`);
      for (const suggestion of error.suggestions || []) {
        console.log(`  - ${suggestion}`);
      }
    }
  }
}

// ============================================================================
// Example 7: Visual Issue Debugging
// ============================================================================

async function example7_VisualDebugging() {
  console.log('\n=== Example 7: Visual Issue Debugging ===\n');

  // Load UI screenshot with issues
  const uiScreenshot = Buffer.from('ui-issue-data');

  // Debug visual issues
  const result = await debugVisualIssue({
    image: uiScreenshot,
    context: 'After recent update, layout broken',
    reproduceSteps: true,
    suggestFixes: true
  });

  console.log('Issues detected:', result.issues.length);

  for (const issue of result.issues) {
    console.log(`\n${issue.severity.toUpperCase()}: ${issue.description}`);
  }

  if (result.reproduction) {
    console.log('\nReproduction steps:');
    result.reproduction.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
  }

  if (result.fixes) {
    console.log('\nSuggested fixes:');
    for (const fix of result.fixes) {
      console.log(`  - [${fix.priority.toUpperCase()}] ${fix.solution}`);
    }
  }
}

// ============================================================================
// Example 8: Screenshot Comparison
// ============================================================================

async function example8_ScreenshotComparison() {
  console.log('\n=== Example 8: Screenshot Comparison ===\n');

  // Load before/after screenshots
  const before = Buffer.from('before-screenshot');
  const after = Buffer.from('after-screenshot');

  // Compare screenshots
  const comparison = await compareScreenshots(
    before,
    after,
    'Before and after layout fix'
  );

  console.log('Differences:', comparison.differences.length);
  console.log('Similarities:', comparison.similarities.length);
  console.log('Severity:', comparison.severity);

  if (comparison.differences.length > 0) {
    console.log('\nKey differences:');
    comparison.differences.slice(0, 5).forEach(diff => {
      console.log(`  - ${diff}`);
    });
  }
}

// ============================================================================
// Example 9: OCR Text Recognition
// ============================================================================

async function example9_OCRRecognition() {
  console.log('\n=== Example 9: OCR Text Recognition ===\n');

  // Load document image
  const document = Buffer.from('document-image');

  // Recognize text
  const result = await recognizeText({
    image: document,
    language: 'eng',
    preprocess: true,
    segmentByLines: true
  });

  console.log('Recognized text:');
  console.log(result.text);
  console.log('\nConfidence:', Math.round(result.confidence * 100) + '%');
  console.log('Lines detected:', result.lines.length);

  // Validate quality
  const validation = validateOCRQuality(result);
  console.log('\nQuality check:', validation.isValid ? 'PASSED' : 'FAILED');
  if (!validation.isValid) {
    console.log('Issues:');
    validation.issues.forEach(issue => console.log(`  - ${issue}`));
  }
}

// ============================================================================
// Example 10: Code OCR
// ============================================================================

async function example10_CodeOCR() {
  console.log('\n=== Example 10: Code-Specific OCR ===\n');

  // Load code image
  const codeImage = Buffer.from('code-image');

  // Recognize code with specialized OCR
  const result = await recognizeCode(codeImage, 'eng');

  console.log('Recognized code:');
  console.log(result.code);
  console.log('\nConfidence:', Math.round(result.confidence * 100) + '%');
}

// ============================================================================
// Example 11: Multimodal Document Storage
// ============================================================================

async function example11_DocumentStorage() {
  console.log('\n=== Example 11: Multimodal Document Storage ===\n');

  // Store various types of documents
  const textDoc = await storeDocument({
    type: 'text',
    content: 'This is a sample text document about React hooks.',
    metadata: {
      source: 'documentation',
      timestamp: new Date(),
      tags: ['react', 'hooks', 'frontend'],
      language: 'english'
    }
  });

  console.log('Stored text document:', textDoc.id);
  console.log('Embedding dimension:', textDoc.embedding.dimension);

  const codeDoc = await storeDocument({
    type: 'code',
    content: 'useEffect(() => { fetchData(); }, []);',
    metadata: {
      source: 'code-editor',
      timestamp: new Date(),
      language: 'javascript',
      tags: ['react', 'hooks', 'useEffect']
    }
  });

  console.log('Stored code document:', codeDoc.id);
}

// ============================================================================
// Example 12: Text Search
// ============================================================================

async function example12_TextSearch() {
  console.log('\n=== Example 12: Multimodal Text Search ===\n');

  // Search by text query
  const result = await searchByText('react hooks example', {
    mediaTypes: ['text', 'code'],
    limit: 5
  });

  console.log('Search results:', result.metadata.totalResults);
  console.log('Processing time:', result.metadata.processingTime, 'ms');

  result.documents.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.document.type} - Relevance: ${Math.round(item.relevance * 100)}%`);
    if (item.highlights) {
      console.log('   Highlights:', item.highlights.join(', '));
    }
  });
}

// ============================================================================
// Example 13: Image Search (Cross-Modal)
// ============================================================================

async function example13_ImageSearch() {
  console.log('\n=== Example 13: Cross-Modal Image Search ===\n');

  // Search with image query to find related text/code
  const queryImage = Buffer.from('screenshot-of-react-component');

  const result = await searchByImage(queryImage, {
    mediaTypes: ['text', 'code'],
    limit: 10
  });

  console.log('Found related documents:', result.metadata.totalResults);

  result.documents.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.document.type}`);
    console.log('   Reasoning:', item.reasoning);
  });
}

// ============================================================================
// Example 14: Hybrid Search
// ============================================================================

async function example14_HybridSearch() {
  console.log('\n=== Example 14: Hybrid Search ===\n');

  // Search with both text and image
  const textQuery = 'how to use useEffect';
  const imageQuery = Buffer.from('screenshot-showing-error');

  const result = await hybridSearch(textQuery, imageQuery, {
    limit: 5
  });

  console.log('Hybrid search results:', result.metadata.totalResults);
  console.log('Query type:', result.metadata.queryType);

  result.documents.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.document.type} - ${Math.round(item.relevance * 100)}%`);
  });
}

// ============================================================================
// Example 15: Accessibility Analysis
// ============================================================================

async function example15_Accessibility() {
  console.log('\n=== Example 15: Accessibility Analysis ===\n');

  // Load UI screenshot
  const uiScreenshot = Buffer.from('ui-screenshot');

  // Analyze accessibility
  const accessibility = await analyzeAccessibility(uiScreenshot);

  console.log('Accessibility score:', accessibility.score, '/ 100');
  console.log('Issues found:', accessibility.issues.length);

  accessibility.issues.forEach((issue, index) => {
    console.log(`\n${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
    if (issue.wcagCriteria) {
      console.log(`   WCAG: ${issue.wcagCriteria}`);
    }
  });

  console.log('\nSuggestions:');
  accessibility.suggestions.forEach((suggestion, index) => {
    console.log(`  ${index + 1}. ${suggestion}`);
  });
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  try {
    await example1_ScreenshotAnalysis();
    await example2_CodeExtraction();
    await example3_WhiteboardCapture();
    await example4_DiagramAnalysis();
    await example5_FlowchartToCode();
    await example6_ErrorDebugging();
    await example7_VisualDebugging();
    await example8_ScreenshotComparison();
    await example9_OCRRecognition();
    await example10_CodeOCR();
    await example11_DocumentStorage();
    await example12_TextSearch();
    await example13_ImageSearch();
    await example14_HybridSearch();
    await example15_Accessibility();

    console.log('\n=== All Examples Completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main();
}

export {
  example1_ScreenshotAnalysis,
  example2_CodeExtraction,
  example3_WhiteboardCapture,
  example4_DiagramAnalysis,
  example5_FlowchartToCode,
  example6_ErrorDebugging,
  example7_VisualDebugging,
  example8_ScreenshotComparison,
  example9_OCRRecognition,
  example10_CodeOCR,
  example11_DocumentStorage,
  example12_TextSearch,
  example13_ImageSearch,
  example14_HybridSearch,
  example15_Accessibility
};
