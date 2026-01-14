/**
 * Utils Module Exports
 * Utility functions for image processing and embeddings
 */

export {
  isValidImage,
  detectImageFormat,
  getMimeType,
  getImageDimensions,
  bufferToBase64,
  base64ToBuffer,
  resizeImage,
  compressImage,
  convertToGrayscale,
  enhanceContrast,
  denoiseImage,
  rotateImage,
  cropImage,
  getAspectRatio,
  getImageSize,
  getHumanReadableSize,
  estimateDPI,
  getResolution,
  assessQuality,
  isSuitableForOCR,
  preprocessForOCR,
  preprocessForVision,
  percentageToPixels,
  pixelsToPercentage,
  scaleBoundingBox,
  bboxToPixels,
  bboxToPercentage
} from './image';

export {
  cosineSimilarity,
  euclideanDistance,
  manhattanDistance,
  dotProduct,
  addVectors,
  subtractVectors,
  multiplyVector,
  normalizeVector,
  vectorMagnitude,
  averageVectors,
  validateEmbedding,
  createEmbedding,
  flattenEmbedding,
  unflattenEmbedding,
  similarityMatrix,
  findMostSimilar,
  clusterEmbeddings,
  reduceDimension,
  padEmbedding,
  tokenize,
  wordFrequency,
  extractTFIDF,
  randomEmbedding,
  serializeEmbedding,
  deserializeEmbedding
} from './embedding';
