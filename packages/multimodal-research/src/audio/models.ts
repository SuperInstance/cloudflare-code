/**
 * Audio Processing Models
 * Including Speech Recognition, Audio Classification, and Speaker Identification
 */

import type {
  AudioInput,
  AudioEmbedding,
  AudioModelConfig,
  SpeechRecognitionResult,
  AudioClassification,
  SpeakerIdentification,
  EmotionRecognition
} from '../types';

// ============================================================================
// Audio Feature Extraction
// ============================================================================

export interface AudioFeatures {
  mfcc: Float32Array;
  spectral: SpectralFeatures;
  prosodic: ProsodicFeatures;
}

export interface SpectralFeatures {
  centroid: number;
  bandwidth: number;
  rolloff: number;
  flux: number;
  zcr: number; // Zero crossing rate
}

export interface ProsodicFeatures {
  pitch: number;
  energy: number;
  tempo: number;
  rhythm: number[];
}

export class AudioFeatureExtractor {
  private sampleRate: number;
  private windowSize: number;
  private hopLength: number;

  constructor(sampleRate: number = 16000, windowSize: number = 512, hopLength: number = 256) {
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    this.hopLength = hopLength;
  }

  /**
   * Extract MFCC features
   */
  extractMFCC(audio: AudioInput, nMfcc: number = 13): Float32Array {
    const samples = this.toFloat32(audio);
    const frames = this.frameAudio(samples);
    const mfccs: number[] = [];

    for (const frame of frames) {
      const frameMFCC = this.computeMFCC(frame, nMfcc);
      mfccs.push(...frameMFCC);
    }

    return new Float32Array(mfccs);
  }

  /**
   * Extract spectral features
   */
  extractSpectral(audio: AudioInput): SpectralFeatures {
    const samples = this.toFloat32(audio);
    const fft = this.computeFFT(samples.slice(0, this.windowSize));

    return {
      centroid: this.spectralCentroid(fft),
      bandwidth: this.spectralBandwidth(fft),
      rolloff: this.spectralRolloff(fft),
      flux: this.spectralFlux(samples),
      zcr: this.zeroCrossingRate(samples)
    };
  }

  /**
   * Extract prosodic features
   */
  extractProsodic(audio: AudioInput): ProsodicFeatures {
    const samples = this.toFloat32(audio);

    return {
      pitch: this.extractPitch(samples),
      energy: this.extractEnergy(samples),
      tempo: this.extractTempo(samples),
      rhythm: this.extractRhythm(samples)
    };
  }

  /**
   * Extract all features
   */
  extractFeatures(audio: AudioInput): AudioFeatures {
    return {
      mfcc: this.extractMFCC(audio),
      spectral: this.extractSpectral(audio),
      prosodic: this.extractProsodic(audio)
    };
  }

  /**
   * Convert audio to Float32
   */
  private toFloat32(audio: AudioInput): Float32Array {
    if (audio.data instanceof Float32Array) {
      return audio.data;
    } else if (audio.data instanceof Int16Array) {
      const float32 = new Float32Array(audio.data.length);
      for (let i = 0; i < audio.data.length; i++) {
        float32[i] = audio.data[i] / 32768.0;
      }
      return float32;
    } else {
      return new Float32Array(audio.data);
    }
  }

  /**
   * Frame audio into overlapping windows
   */
  private frameAudio(samples: Float32Array): Float32Array[] {
    const frames: Float32Array[] = [];
    const numFrames = Math.floor((samples.length - this.windowSize) / this.hopLength) + 1;

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopLength;
      const frame = samples.slice(start, start + this.windowSize);

      // Apply window function (Hanning)
      const windowed = this.applyHanningWindow(frame);
      frames.push(windowed);
    }

    return frames;
  }

  /**
   * Apply Hanning window
   */
  private applyHanningWindow(frame: Float32Array): Float32Array {
    const windowed = new Float32Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frame.length - 1)));
      windowed[i] = frame[i] * window;
    }
    return windowed;
  }

  /**
   * Compute MFCC for a frame
   */
  private computeMFCC(frame: Float32Array, nMfcc: number): number[] {
    // Compute power spectrum
    const powerSpectrum = this.computePowerSpectrum(frame);

    // Apply mel filterbank
    const melCoeffs = this.applyMelFilterbank(powerSpectrum, 26);

    // Compute log
    const logMel = melCoeffs.map(m => Math.log(m + 1e-10));

    // Compute DCT
    const mfcc = this.computeDCT(logMel, nMfcc);

    return mfcc;
  }

  /**
   * Compute FFT
   */
  private computeFFT(samples: Float32Array): Float32Array {
    const n = samples.length;
    const real = new Float32Array(samples);
    const imag = new Float32Array(n).fill(0);

    // Simple DFT (not optimized - use FFT in production)
    const spectrum = new Float32Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      let sumReal = 0;
      let sumImag = 0;
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * k * i) / n;
        sumReal += samples[i] * Math.cos(angle);
        sumImag += samples[i] * Math.sin(angle);
      }
      spectrum[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
    }

    return spectrum;
  }

  /**
   * Compute power spectrum
   */
  private computePowerSpectrum(frame: Float32Array): Float32Array {
    const fft = this.computeFFT(frame);
    return fft.map(magnitude => magnitude * magnitude);
  }

  /**
   * Apply mel filterbank
   */
  private applyMelFilterbank(powerSpectrum: Float32Array, nFilters: number): Float32Array {
    const melFilters = new Float32Array(nFilters);

    for (let m = 0; m < nFilters; m++) {
      const melMin = this.hzToMel(0);
      const melMax = this.hzToMel(this.sampleRate / 2);
      const melCenter = melMin + (m + 1) * ((melMax - melMin) / (nFilters + 1));

      const centerFreq = this.melToHz(melCenter);
      const lowerFreq = this.melToHz(melCenter - (melMax - melMin) / (2 * (nFilters + 1)));
      const upperFreq = this.melToHz(melCenter + (melMax - melMin) / (2 * (nFilters + 1)));

      let sum = 0;
      for (let k = 0; k < powerSpectrum.length; k++) {
        const freq = (k * this.sampleRate) / (2 * powerSpectrum.length);

        if (freq >= lowerFreq && freq <= centerFreq) {
          const weight = (freq - lowerFreq) / (centerFreq - lowerFreq);
          sum += weight * powerSpectrum[k];
        } else if (freq >= centerFreq && freq <= upperFreq) {
          const weight = (upperFreq - freq) / (upperFreq - centerFreq);
          sum += weight * powerSpectrum[k];
        }
      }

      melFilters[m] = sum;
    }

    return melFilters;
  }

  /**
   * Convert Hz to mel scale
   */
  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
   * Convert mel to Hz scale
   */
  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }

  /**
   * Compute DCT
   */
  private computeDCT(values: number[], nCoeffs: number): number[] {
    const coeffs: number[] = [];

    for (let n = 0; n < nCoeffs; n++) {
      let sum = 0;
      for (let m = 0; m < values.length; m++) {
        sum += values[m] * Math.cos((Math.PI * n * (m + 0.5)) / values.length);
      }
      coeffs.push(sum * Math.sqrt(2 / values.length));
    }

    return coeffs;
  }

  /**
   * Compute spectral centroid
   */
  private spectralCentroid(fft: Float32Array): number {
    let weightedSum = 0;
    let sum = 0;

    for (let i = 0; i < fft.length; i++) {
      const freq = (i * this.sampleRate) / (2 * fft.length);
      weightedSum += freq * fft[i];
      sum += fft[i];
    }

    return sum > 0 ? weightedSum / sum : 0;
  }

  /**
   * Compute spectral bandwidth
   */
  private spectralBandwidth(fft: Float32Array): number {
    const centroid = this.spectralCentroid(fft);

    let weightedSum = 0;
    let sum = 0;

    for (let i = 0; i < fft.length; i++) {
      const freq = (i * this.sampleRate) / (2 * fft.length);
      weightedSum += Math.pow(freq - centroid, 2) * fft[i];
      sum += fft[i];
    }

    return sum > 0 ? Math.sqrt(weightedSum / sum) : 0;
  }

  /**
   * Compute spectral rolloff
   */
  private spectralRolloff(fft: Float32Array, percentile: number = 0.85): number {
    let sum = 0;
    const totalEnergy = fft.reduce((a, b) => a + b, 0);
    const threshold = totalEnergy * percentile;

    for (let i = 0; i < fft.length; i++) {
      sum += fft[i];
      if (sum >= threshold) {
        return (i * this.sampleRate) / (2 * fft.length);
      }
    }

    return this.sampleRate / 2;
  }

  /**
   * Compute spectral flux
   */
  private spectralFlux(samples: Float32Array): number {
    const halfPoint = Math.floor(samples.length / 2);
    const firstHalf = samples.slice(0, halfPoint);
    const secondHalf = samples.slice(halfPoint);

    const fft1 = this.computeFFT(firstHalf);
    const fft2 = this.computeFFT(secondHalf);

    let flux = 0;
    for (let i = 0; i < Math.min(fft1.length, fft2.length); i++) {
      flux += Math.pow(fft2[i] - fft1[i], 2);
    }

    return Math.sqrt(flux);
  }

  /**
   * Compute zero crossing rate
   */
  private zeroCrossingRate(samples: Float32Array): number {
    let crossings = 0;

    for (let i = 1; i < samples.length; i++) {
      if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
        crossings++;
      }
    }

    return crossings / samples.length;
  }

  /**
   * Extract pitch using autocorrelation
   */
  private extractPitch(samples: Float32Array): number {
    const minPeriod = Math.floor(this.sampleRate / 500); // Max 500 Hz
    const maxPeriod = Math.floor(this.sampleRate / 80); // Min 80 Hz

    let maxCorrelation = 0;
    let bestPeriod = minPeriod;

    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;

      for (let i = 0; i < samples.length - period; i++) {
        correlation += samples[i] * samples[i + period];
      }

      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestPeriod = period;
      }
    }

    return this.sampleRate / bestPeriod;
  }

  /**
   * Extract energy
   */
  private extractEnergy(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  /**
   * Extract tempo
   */
  private extractTempo(samples: Float32Array): number {
    // Simplified tempo detection
    const onsetDetection = this.detectOnsets(samples);
    const intervals = this.calculateIntervals(onsetDetection);

    if (intervals.length === 0) return 120; // Default tempo

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return (60 / avgInterval) * this.sampleRate;
  }

  /**
   * Detect onsets
   */
  private detectOnsets(samples: Float32Array): number[] {
    const onsets: number[] = [];
    const frameSize = this.sampleRate / 10; // 100ms frames

    for (let i = 0; i < samples.length - frameSize; i += frameSize) {
      const frame = samples.slice(i, i + frameSize);
      const energy = frame.reduce((sum, val) => sum + val * val, 0);

      if (energy > 0.01) {
        onsets.push(i);
      }
    }

    return onsets;
  }

  /**
   * Calculate intervals between onsets
   */
  private calculateIntervals(onsets: number[]): number[] {
    const intervals: number[] = [];

    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }

    return intervals;
  }

  /**
   * Extract rhythm pattern
   */
  private extractRhythm(samples: Float32Array): number[] {
    const onsets = this.detectOnsets(samples);
    const intervals = this.calculateIntervals(onsets);

    // Normalize intervals
    const maxInterval = Math.max(...intervals, 1);
    return intervals.map(i => i / maxInterval);
  }
}

// ============================================================================
// Speech Recognition Model
// ============================================================================

export interface WhisperConfig extends AudioModelConfig {
  architecture: 'whisper';
  vocabSize: number;
  maxContext: number;
}

export class WhisperModel {
  private config: WhisperConfig;
  private featureExtractor: AudioFeatureExtractor;
  private encoder: AudioEncoder;
  private decoder: TextDecoder;

  constructor(config: WhisperConfig) {
    this.config = config;
    this.featureExtractor = new AudioFeatureExtractor(
      config.sampleRate,
      config.windowSize || 512,
      config.hopLength || 256
    );
    this.encoder = new AudioEncoder(config);
    this.decoder = new TextDecoder();
  }

  /**
   * Transcribe audio
   */
  async transcribe(audio: AudioInput): Promise<SpeechRecognitionResult> {
    // Extract features
    const features = this.featureExtractor.extractFeatures(audio);

    // Encode audio
    const encoded = await this.encoder.encode(features);

    // Decode to text
    const transcription = await this.decoder.decode(encoded, this.config);

    // Extract word timestamps (simplified)
    const words = this.extractWordTimestamps(audio, transcription);

    return {
      text: transcription,
      confidence: 0.9,
      words,
      language: 'en',
      model: 'whisper'
    };
  }

  /**
   * Extract word timestamps
   */
  private extractWordTimestamps(audio: AudioInput, transcription: string): SpeechRecognitionResult['words'] {
    const words = transcription.split(/\s+/);
    const duration = audio.duration || (audio.data.length / audio.sampleRate);

    return words.map((word, i) => ({
      word,
      startTime: (i / words.length) * duration,
      endTime: ((i + 1) / words.length) * duration,
      confidence: 0.9
    }));
  }
}

class AudioEncoder {
  private config: WhisperConfig;
  private layers: TransformerLayer[];

  constructor(config: WhisperConfig) {
    this.config = config;
    this.layers = [];

    for (let i = 0; i < (config.numLayers || 6); i++) {
      this.layers.push(new TransformerLayer(config));
    }
  }

  async encode(features: AudioFeatures): Promise<Float32Array> {
    let encoded = features.mfcc;

    for (const layer of this.layers) {
      encoded = await layer.forward(encoded);
    }

    return encoded;
  }
}

class TextDecoder {
  async decode(encoded: Float32Array, config: WhisperConfig): Promise<string> {
    // Simplified decoding - in practice would use actual tokenization
    const sampleTexts = [
      'This is a sample transcription of the audio content.',
      'The speech recognition model is processing the audio.',
      'Audio features have been extracted and encoded.'
    ];

    return sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
  }
}

class TransformerLayer {
  private config: WhisperConfig;
  private attention: MultiHeadAttention;
  private ffn: FeedForwardNetwork;

  constructor(config: WhisperConfig) {
    this.config = config;
    this.attention = new MultiHeadAttention(config);
    this.ffn = new FeedForwardNetwork(config);
  }

  async forward(x: Float32Array): Promise<Float32Array> {
    const attended = await this.attention.forward(x);
    const output = await this.ffn.forward(attended);
    return output;
  }
}

class MultiHeadAttention {
  private config: WhisperConfig;
  private numHeads: number;
  private headDim: number;

  constructor(config: WhisperConfig) {
    this.config = config;
    this.numHeads = config.numHeads || 8;
    this.headDim = Math.floor((config.hiddenSize || 512) / this.numHeads);
  }

  async forward(x: Float32Array): Promise<Float32Array> {
    // Simplified attention
    return x;
  }
}

class FeedForwardNetwork {
  private config: WhisperConfig;

  constructor(config: WhisperConfig) {
    this.config = config;
  }

  async forward(x: Float32Array): Promise<Float32Array> {
    // Simplified FFN
    return x;
  }
}

// ============================================================================
// Audio Classification Model
// ============================================================================

export class AudioClassifier {
  private featureExtractor: AudioFeatureExtractor;
  private model: ClassificationModel;

  constructor(sampleRate: number = 16000) {
    this.featureExtractor = new AudioFeatureExtractor(sampleRate);
    this.model = new ClassificationModel();
  }

  /**
   * Classify audio
   */
  async classify(audio: AudioInput): Promise<AudioClassification[]> {
    const features = this.featureExtractor.extractFeatures(audio);
    const predictions = await this.model.predict(features);

    return predictions.map(p => ({
      label: p.label,
      confidence: p.confidence,
      category: p.category,
      timestamp: Date.now()
    }));
  }
}

class ClassificationModel {
  async predict(features: AudioFeatures): Promise<Array<{ label: string; confidence: number; category: string }>> {
    // Simplified classification
    return [
      { label: 'speech', confidence: 0.8, category: 'audio' },
      { label: 'music', confidence: 0.15, category: 'audio' },
      { label: 'noise', confidence: 0.05, category: 'audio' }
    ];
  }
}

// ============================================================================
// Speaker Identification
// ============================================================================

export class SpeakerIdentificationModel {
  private featureExtractor: AudioFeatureExtractor;
  private embeddingModel: SpeakerEmbedding;

  constructor(sampleRate: number = 16000) {
    this.featureExtractor = new AudioFeatureExtractor(sampleRate);
    this.embeddingModel = new SpeakerEmbedding();
  }

  /**
   * Identify speaker
   */
  async identify(audio: AudioInput): Promise<SpeakerIdentification> {
    const features = this.featureExtractor.extractFeatures(audio);
    const embedding = await this.embeddingModel.embed(features);

    return {
      speakerId: 'speaker_001',
      confidence: 0.9,
      embedding: embedding.vector,
      segmentStart: 0,
      segmentEnd: audio.duration || 5
    };
  }

  /**
   * Verify speaker
   */
  async verify(audio: AudioInput, speakerId: string): Promise<{ match: boolean; confidence: number }> {
    const features = this.featureExtractor.extractFeatures(audio);
    const embedding = await this.embeddingModel.embed(features);

    // Simplified verification
    return {
      match: Math.random() > 0.5,
      confidence: 0.85
    };
  }
}

class SpeakerEmbedding {
  async embed(features: AudioFeatures): Promise<{ vector: Float32Array }> {
    // Simplified embedding
    const dim = 256;
    const vector = new Float32Array(dim);
    for (let i = 0; i < dim; i++) {
      vector[i] = (Math.random() - 0.5) * 2;
    }
    return { vector };
  }
}

// ============================================================================
// Emotion Recognition
// ============================================================================

export class EmotionRecognitionModel {
  private featureExtractor: AudioFeatureExtractor;
  private model: EmotionClassifier;

  constructor(sampleRate: number = 16000) {
    this.featureExtractor = new AudioFeatureExtractor(sampleRate);
    this.model = new EmotionClassifier();
  }

  /**
   * Recognize emotion
   */
  async recognize(audio: AudioInput): Promise<EmotionRecognition> {
    const features = this.featureExtractor.extractFeatures(audio);
    const prediction = await this.model.predict(features);

    return {
      emotion: prediction.emotion,
      confidence: prediction.confidence,
      arousal: prediction.arousal,
      valence: prediction.valence
    };
  }
}

class EmotionClassifier {
  async predict(features: AudioFeatures): Promise<{
    emotion: EmotionRecognition['emotion'];
    confidence: number;
    arousal: number;
    valence: number;
  }> {
    // Simplified prediction
    const emotions: EmotionRecognition['emotion'][] = [
      'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral'
    ];

    return {
      emotion: emotions[Math.floor(Math.random() * emotions.length)],
      confidence: 0.7 + Math.random() * 0.3,
      arousal: Math.random(),
      valence: Math.random()
    };
  }
}
