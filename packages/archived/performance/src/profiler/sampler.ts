/**
 * Statistical Sampler for Performance Metrics
 *
 * Provides efficient sampling strategies for high-frequency metrics
 */

export interface SampleOptions {
  maxSize: number;
  reservoirSize?: number;
  retainOrder?: boolean;
}

export class StatisticalSampler<T> {
  private samples: T[] = [];
  private maxSize: number;
  private reservoirSize: number;
  private retainOrder: boolean;
  private count = 0;

  constructor(options: SampleOptions = { maxSize: 1000 }) {
    this.maxSize = options.maxSize;
    this.reservoirSize = options.reservoirSize || options.maxSize;
    this.retainOrder = options.retainOrder !== false;
  }

  /**
   * Add a sample
   */
  add(sample: T): void {
    this.count++;

    if (this.samples.length < this.reservoirSize) {
      // Fill reservoir
      this.samples.push(sample);
    } else {
      // Reservoir sampling
      const replaceIndex = Math.floor(Math.random() * this.count);
      if (replaceIndex < this.reservoirSize) {
        this.samples[replaceIndex] = sample;
      }
    }

    // Trim to max size
    if (this.samples.length > this.maxSize) {
      if (this.retainOrder) {
        this.samples.shift();
      } else {
        this.samples = this.samples.slice(0, this.maxSize);
      }
    }
  }

  /**
   * Add multiple samples
   */
  addAll(samples: T[]): void {
    for (const sample of samples) {
      this.add(sample);
    }
  }

  /**
   * Get all samples
   */
  getSamples(): T[] {
    return [...this.samples];
  }

  /**
   * Get sample count
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Clear samples
   */
  clear(): void {
    this.samples = [];
    this.count = 0;
  }

  /**
   * Calculate statistics on numeric samples
   */
  getStatistics(extract?: (sample: T) => number): SampleStatistics {
    const numbers = extract
      ? this.samples.map(extract)
      : (this.samples as unknown as number[]);

    if (numbers.length === 0) {
      return {
        count: 0,
        sum: 0,
        mean: 0,
        median: 0,
        mode: 0,
        stdDev: 0,
        variance: 0,
        min: 0,
        max: 0,
        range: 0,
        percentile25: 0,
        percentile50: 0,
        percentile75: 0,
        percentile95: 0,
        percentile99: 0,
      };
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / numbers.length;
    const variance =
      numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: numbers.length,
      sum,
      mean,
      median: this.percentile(sorted, 50),
      mode: this.calculateMode(numbers),
      stdDev,
      variance,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      range: sorted[sorted.length - 1] - sorted[0],
      percentile25: this.percentile(sorted, 25),
      percentile50: this.percentile(sorted, 50),
      percentile75: this.percentile(sorted, 75),
      percentile95: this.percentile(sorted, 95),
      percentile99: this.percentile(sorted, 99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= sorted.length) {
      return sorted[sorted.length - 1];
    }

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Calculate mode
   */
  private calculateMode(numbers: number[]): number {
    const frequency = new Map<number, number>();
    let maxFreq = 0;
    let mode = numbers[0];

    for (const num of numbers) {
      const freq = (frequency.get(num) || 0) + 1;
      frequency.set(num, freq);

      if (freq > maxFreq) {
        maxFreq = freq;
        mode = num;
      }
    }

    return mode;
  }

  /**
   * Detect outliers using IQR method
   */
  detectOutliers(extract?: (sample: T) => number): { outliers: T[]; bounds: { lower: number; upper: number } } {
    const stats = this.getStatistics(extract);
    const iqr = stats.percentile75 - stats.percentile25;
    const lower = stats.percentile25 - 1.5 * iqr;
    const upper = stats.percentile75 + 1.5 * iqr;

    const outliers = this.samples.filter((sample) => {
      const value = extract ? extract(sample) : (sample as unknown as number);
      return value < lower || value > upper;
    });

    return { outliers, bounds: { lower, upper } };
  }

  /**
   * Export samples to CSV
   */
  toCSV(format?: (sample: T) => string): string {
    const lines = this.samples.map((sample) =>
      format ? format(sample) : String(sample)
    );
    return lines.join('\n');
  }

  /**
   * Import samples from CSV
   */
  static fromCSV<T>(csv: string, parse?: (line: string) => T): StatisticalSampler<T> {
    const sampler = new StatisticalSampler<T>({ maxSize: 10000 });
    const lines = csv.trim().split('\n');

    for (const line of lines) {
      const sample = parse ? parse(line) : (line as unknown as T);
      sampler.add(sample);
    }

    return sampler;
  }
}

export interface SampleStatistics {
  count: number;
  sum: number;
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  percentile25: number;
  percentile50: number;
  percentile75: number;
  percentile95: number;
  percentile99: number;
}

/**
 * Time-series sampler with automatic downsampling
 */
export class TimeSeriesSampler {
  private samples: { timestamp: number; value: number }[] = [];
  private maxResolution: number; // Maximum samples per time period
  private timeWindow: number; // Time window in milliseconds

  constructor(maxResolution = 1000, timeWindow = 60000) {
    this.maxResolution = maxResolution;
    this.timeWindow = timeWindow;
  }

  /**
   * Add a time-stamped sample
   */
  add(timestamp: number, value: number): void {
    this.samples.push({ timestamp, value });
    this.downsample();
  }

  /**
   * Downsample to maintain resolution
   */
  private downsample(): void {
    if (this.samples.length <= this.maxResolution) {
      return;
    }

    // Sort by timestamp
    this.samples.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate target interval
    const timeSpan = this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp;
    const interval = Math.max(timeSpan / this.maxResolution, 1);

    // Resample using averaging
    const resampled: typeof this.samples = [];
    let bucketStart = this.samples[0].timestamp;
    let bucketSum = 0;
    let bucketCount = 0;

    for (const sample of this.samples) {
      if (sample.timestamp < bucketStart + interval) {
        bucketSum += sample.value;
        bucketCount++;
      } else {
        if (bucketCount > 0) {
          resampled.push({
            timestamp: bucketStart,
            value: bucketSum / bucketCount,
          });
        }
        bucketStart = sample.timestamp;
        bucketSum = sample.value;
        bucketCount = 1;
      }
    }

    // Add last bucket
    if (bucketCount > 0) {
      resampled.push({
        timestamp: bucketStart,
        value: bucketSum / bucketCount,
      });
    }

    this.samples = resampled;
  }

  /**
   * Get samples in time range
   */
  getRange(startTime: number, endTime: number): typeof this.samples {
    return this.samples.filter(
      (s) => s.timestamp >= startTime && s.timestamp <= endTime
    );
  }

  /**
   * Get latest samples
   */
  getLatest(count: number): typeof this.samples {
    return this.samples.slice(-count);
  }

  /**
   * Clear samples
   */
  clear(): void {
    this.samples = [];
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const values = this.samples.map((s) => s.value);
    const sampler = new StatisticalSampler<number>({ maxSize: values.length });
    sampler.addAll(values);

    return {
      ...sampler.getStatistics(),
      timeSpan:
        this.samples.length > 0
          ? this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp
          : 0,
      sampleCount: this.samples.length,
    };
  }
}

export default StatisticalSampler;
