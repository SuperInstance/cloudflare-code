/**
 * Audio Feature Extraction
 * Comprehensive audio feature extraction for various audio processing tasks
 */

// @ts-nocheck

import type { AudioInput } from '../types';

export interface AudioFeatures {
  mfcc: Float32Array;
  spectral: SpectralFeatures;
  prosodic: ProsodicFeatures;
  chroma: ChromaFeatures;
  tonnetz: TonnetzFeatures;
}

export interface SpectralFeatures {
  centroid: number;
  bandwidth: number;
  rolloff: number;
  flux: number;
  zcr: number;
  flatness: number;
  contrast: number[];
}

export interface ProsodicFeatures {
  pitch: number;
  energy: number;
  tempo: number;
  rhythm: number[];
  intonation: number[];
}

export interface ChromaFeatures {
  chroma: number[]; // 12 chroma bins
  tuning: number;
}

export interface TonnetzFeatures {
  tonnetz: number[]; // 6 tonnetz dimensions
}

export class AdvancedAudioFeatures {
  private sampleRate: number;
  private windowSize: number;
  private hopLength: number;

  constructor(sampleRate: number = 16000, windowSize: number = 2048, hopLength: number = 512) {
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    this.hopLength = hopLength;
  }

  /**
   * Extract comprehensive audio features
   */
  extractAllFeatures(audio: AudioInput): AudioFeatures {
    return {
      mfcc: this.extractMFCC(audio),
      spectral: this.extractSpectralFeatures(audio),
      prosodic: this.extractProsodicFeatures(audio),
      chroma: this.extractChromaFeatures(audio),
      tonnetz: this.extractTonnetzFeatures(audio)
    };
  }

  /**
   * Extract MFCC features with deltas
   */
  extractMFCC(audio: AudioInput, nMfcc: number = 20, includeDeltas: boolean = true): Float32Array {
    const samples = this.toFloat32(audio);
    const frames = this.frameAudio(samples);
    const mfccs: number[] = [];

    // Extract static MFCCs
    for (const frame of frames) {
      const frameMFCC = this.computeMFCCFrame(frame, nMfcc);
      mfccs.push(...frameMFCC);
    }

    // Compute deltas if requested
    if (includeDeltas && frames.length > 1) {
      const deltas = this.computeDeltas(mfccs, nMfcc);
      const deltaDeltas = this.computeDeltas(deltas, nMfcc);
      return new Float32Array([...mfccs, ...deltas, ...deltaDeltas]);
    }

    return new Float32Array(mfccs);
  }

  /**
   * Extract spectral features
   */
  extractSpectralFeatures(audio: AudioInput): SpectralFeatures {
    const samples = this.toFloat32(audio);
    const frames = this.frameAudio(samples);

    const features: SpectralFeatures = {
      centroid: 0,
      bandwidth: 0,
      rolloff: 0,
      flux: 0,
      zcr: 0,
      flatness: 0,
      contrast: []
    };

    let sumCentroid = 0;
    let sumBandwidth = 0;
    let sumRolloff = 0;
    let sumFlux = 0;
    let sumZCR = 0;
    let sumFlatness = 0;
    const allContrast: number[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const fft = this.computeFFT(frame);
      const powerSpectrum = this.computePowerSpectrum(frame);

      sumCentroid += this.spectralCentroid(fft);
      sumBandwidth += this.spectralBandwidth(fft);
      sumRolloff += this.spectralRolloff(fft);
      sumFlux += i > 0 ? this.spectralFlux(frames[i - 1], frame) : 0;
      sumZCR += this.zeroCrossingRate(frame);
      sumFlatness += this.spectralFlatness(powerSpectrum);

      const contrast = this.spectralContrast(powerSpectrum);
      allContrast.push(...contrast);
    }

    features.centroid = sumCentroid / frames.length;
    features.bandwidth = sumBandwidth / frames.length;
    features.rolloff = sumRolloff / frames.length;
    features.flux = sumFlux / frames.length;
    features.zcr = sumZCR / frames.length;
    features.flatness = sumFlatness / frames.length;
    features.contrast = this.averageBands(allContrast, frames.length);

    return features;
  }

  /**
   * Extract prosodic features
   */
  extractProsodicFeatures(audio: AudioInput): ProsodicFeatures {
    const samples = this.toFloat32(audio);

    return {
      pitch: this.extractPitchWithConfidence(samples).pitch,
      energy: this.extractRMS(samples),
      tempo: this.extractTempo(samples),
      rhythm: this.extractRhythmPattern(samples),
      intonation: this.extractIntonation(samples)
    };
  }

  /**
   * Extract chroma features
   */
  extractChromaFeatures(audio: AudioInput): ChromaFeatures {
    const samples = this.toFloat32(audio);
    const frames = this.frameAudio(samples);

    const chromaSum = new Float32Array(12).fill(0);

    for (const frame of frames) {
      const fft = this.computeFFT(frame);
      const chroma = this.chromaFromFFT(fft);
      for (let i = 0; i < 12; i++) {
        chromaSum[i] += chroma[i];
      }
    }

    // Normalize
    const sum = chromaSum.reduce((a, b) => a + b, 0);
    const normalized = sum > 0 ? chromaSum.map(c => c / sum) : chromaSum;

    // Estimate tuning
    const tuning = this.estimateTuning(samples);

    return {
      chroma: Array.from(normalized),
      tuning
    };
  }

  /**
   * Extract tonnetz features
   */
  extractTonnetzFeatures(audio: AudioInput): TonnetzFeatures {
    const chroma = this.extractChromaFeatures(audio);
    const tonnetz = this.chromaToTonnetz(chroma.chroma);

    return {
      tonnetz
    };
  }

  /**
   * Convert to Float32Array
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
   * Frame audio into windows
   */
  private frameAudio(samples: Float32Array): Float32Array[] {
    const frames: Float32Array[] = [];
    const numFrames = Math.floor((samples.length - this.windowSize) / this.hopLength) + 1;

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopLength;
      let frame = samples.slice(start, start + this.windowSize);

      // Pad if necessary
      if (frame.length < this.windowSize) {
        const padded = new Float32Array(this.windowSize);
        padded.set(frame);
        frame = padded;
      }

      frames.push(this.applyHanningWindow(frame));
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
  private computeMFCCFrame(frame: Float32Array, nMfcc: number): number[] {
    const powerSpectrum = this.computePowerSpectrum(frame);
    const melCoeffs = this.applyMelFilterbank(powerSpectrum, 40);
    const logMel = melCoeffs.map(m => Math.log(m + 1e-10));
    const mfcc = this.computeDCT(logMel, nMfcc);

    // Keep first coefficient but scale it
    mfcc[0] *= 0.5;

    return mfcc;
  }

  /**
   * Compute FFT
   */
  private computeFFT(samples: Float32Array): Float32Array {
    const n = samples.length;
    const spectrum = new Float32Array(n / 2);

    // Simple DFT (use FFT library in production)
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
    const melMin = this.hzToMel(0);
    const melMax = this.hzToMel(this.sampleRate / 2);

    for (let m = 0; m < nFilters; m++) {
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
   * Hz to Mel conversion
   */
  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700);
  }

  /**
   * Mel to Hz conversion
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
   * Compute deltas
   */
  private computeDeltas(mfccs: number[], nMfcc: number): number[] {
    const deltas: number[] = [];
    const numFrames = mfccs.length / nMfcc;

    for (let i = 0; i < numFrames; i++) {
      const prev = Math.max(0, i - 1);
      const next = Math.min(numFrames - 1, i + 1);

      for (let j = 0; j < nMfcc; j++) {
        const delta = (mfccs[next * nMfcc + j] - mfccs[prev * nMfcc + j]) / 2;
        deltas.push(delta);
      }
    }

    return deltas;
  }

  /**
   * Spectral centroid
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
   * Spectral bandwidth
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
   * Spectral rolloff
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
   * Spectral flux
   */
  private spectralFlux(prevFrame: Float32Array, currFrame: Float32Array): number {
    const fftPrev = this.computeFFT(prevFrame);
    const fftCurr = this.computeFFT(currFrame);

    let flux = 0;
    for (let i = 0; i < Math.min(fftPrev.length, fftCurr.length); i++) {
      flux += Math.pow(fftCurr[i] - fftPrev[i], 2);
    }

    return Math.sqrt(flux);
  }

  /**
   * Zero crossing rate
   */
  private zeroCrossingRate(frame: Float32Array): number {
    let crossings = 0;

    for (let i = 1; i < frame.length; i++) {
      if ((frame[i - 1] >= 0 && frame[i] < 0) || (frame[i - 1] < 0 && frame[i] >= 0)) {
        crossings++;
      }
    }

    return crossings / frame.length;
  }

  /**
   * Spectral flatness
   */
  private spectralFlatness(powerSpectrum: Float32Array): number {
    const geometricMean = Math.exp(
      powerSpectrum.reduce((sum, val) => sum + Math.log(val + 1e-10), 0) / powerSpectrum.length
    );
    const arithmeticMean =
      powerSpectrum.reduce((sum, val) => sum + val, 0) / powerSpectrum.length;

    return arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;
  }

  /**
   * Spectral contrast
   */
  private spectralContrast(powerSpectrum: Float32Array, nBands: number = 7): number[] {
    const bandContrast: number[] = [];
    const binPerBand = Math.floor(powerSpectrum.length / nBands);

    for (let band = 0; band < nBands; band++) {
      const start = band * binPerBand;
      const end = start + binPerBand;
      const bandValues = powerSpectrum.slice(start, end);

      if (bandValues.length > 0) {
        const mean = bandValues.reduce((a, b) => a + b, 0) / bandValues.length;
        const peak = Math.max(...bandValues);
        bandContrast.push(peak - mean);
      } else {
        bandContrast.push(0);
      }
    }

    return bandContrast;
  }

  /**
   * Average bands across frames
   */
  private averageBands(allValues: number[], numFrames: number): number[] {
    const numBands = allValues.length / numFrames;
    const averaged: number[] = [];

    for (let b = 0; b < numBands; b++) {
      let sum = 0;
      for (let f = 0; f < numFrames; f++) {
        sum += allValues[f * numBands + b];
      }
      averaged.push(sum / numFrames);
    }

    return averaged;
  }

  /**
   * Extract pitch with confidence
   */
  private extractPitchWithConfidence(samples: Float32Array): { pitch: number; confidence: number } {
    const minPeriod = Math.floor(this.sampleRate / 500);
    const maxPeriod = Math.floor(this.sampleRate / 80);

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

    const pitch = this.sampleRate / bestPeriod;
    const confidence = maxCorrelation / (samples.length - bestPeriod);

    return { pitch, confidence };
  }

  /**
   * Extract RMS energy
   */
  private extractRMS(samples: Float32Array): number {
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
    const onsets = this.detectOnsets(samples);
    if (onsets.length < 2) return 120;

    const intervals: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }

    const medianInterval = intervals.sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
    return (60 / (medianInterval / this.sampleRate));
  }

  /**
   * Detect onsets
   */
  private detectOnsets(samples: Float32Array): number[] {
    const onsets: number[] = [];
    const frameSize = Math.floor(this.sampleRate / 100); // 10ms frames

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
   * Extract rhythm pattern
   */
  private extractRhythmPattern(samples: Float32Array): number[] {
    const onsets = this.detectOnsets(samples);
    const intervals: number[] = [];

    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }

    if (intervals.length === 0) return [0];

    const maxInterval = Math.max(...intervals);
    return intervals.map(i => i / maxInterval);
  }

  /**
   * Extract intonation contour
   */
  private extractIntonation(samples: Float32Array): number[] {
    const frameSize = Math.floor(this.sampleRate / 50); // 20ms frames
    const pitchContour: number[] = [];

    for (let i = 0; i < samples.length - frameSize; i += frameSize) {
      const frame = samples.slice(i, i + frameSize);
      const { pitch } = this.extractPitchWithConfidence(frame);
      pitchContour.push(pitch);
    }

    return pitchContour;
  }

  /**
   * Extract chroma from FFT
   */
  private chromaFromFFT(fft: Float32Array): number[] {
    const chroma = new Float32Array(12).fill(0);

    for (let i = 0; i < fft.length; i++) {
      const freq = (i * this.sampleRate) / (2 * fft.length);
      const noteNum = 12 * (Math.log2(freq / 440) + 4.75);
      const chromaBin = Math.round(noteNum) % 12;

      if (chromaBin >= 0 && chromaBin < 12) {
        chroma[chromaBin] += fft[i];
      }
    }

    return chroma;
  }

  /**
   * Estimate tuning frequency
   */
  private estimateTuning(samples: Float32Array): number {
    const fft = this.computeFFT(samples.slice(0, this.windowSize));

    // Find peak frequency
    let maxMag = 0;
    let peakBin = 0;
    for (let i = 1; i < fft.length; i++) {
      if (fft[i] > maxMag) {
        maxMag = fft[i];
        peakBin = i;
      }
    }

    const peakFreq = (peakBin * this.sampleRate) / (2 * fft.length);

    // Find nearest note
    const noteNum = 12 * Math.log2(peakFreq / 440) + 69;
    const nearestNote = Math.round(noteNum);
    const nearestFreq = 440 * Math.pow(2, (nearestNote - 69) / 12);

    return peakFreq - nearestFreq;
  }

  /**
   * Convert chroma to tonnetz
   */
  private chromaToTonnetz(chroma: number[]): number[] {
    const tonnetz: number[] = [];

    // Fifth (P5)
    tonnetz.push(chroma[0] - chroma[7]);
    tonnetz.push(chroma[1] - chroma[8]);
    tonnetz.push(chroma[2] - chroma[9]);
    tonnetz.push(chroma[3] - chroma[10]);
    tonnetz.push(chroma[4] - chroma[11]);
    tonnetz.push(chroma[5] - chroma[0]);

    // Major third (M3)
    tonnetz.push(chroma[0] - chroma[4]);
    tonnetz.push(chroma[1] - chroma[5]);
    tonnetz.push(chroma[2] - chroma[6]);
    tonnetz.push(chroma[3] - chroma[7]);
    tonnetz.push(chroma[4] - chroma[8]);
    tonnetz.push(chroma[5] - chroma[9]);

    // Minor third (m3)
    tonnetz.push(chroma[0] - chroma[3]);
    tonnetz.push(chroma[1] - chroma[4]);
    tonnetz.push(chroma[2] - chroma[5]);
    tonnetz.push(chroma[3] - chroma[6]);
    tonnetz.push(chroma[4] - chroma[7]);
    tonnetz.push(chroma[5] - chroma[8]);

    return tonnetz;
  }
}
