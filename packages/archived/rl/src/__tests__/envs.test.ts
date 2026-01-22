/**
 * Environment Tests
 */

import { describe, it, expect } from 'vitest';
import {
  Box,
  Discrete,
  MultiDiscrete,
  MultiBinary,
  Dict,
  Tuple,
  Env,
} from '../envs/base.js';

describe('Spaces', () => {
  describe('Box', () => {
    it('should create a box space', () => {
      const space = new Box(0, 1, 'float32', [2, 3]);
      expect(space.shape).toEqual([2, 3]);
      expect(space.size).toBe(6);
      expect(space.dtype).toBe('float32');
    });

    it('should sample valid values', () => {
      const space = new Box(0, 1, 'float32', [10]);
      const sample = space.sample();

      expect(Array.isArray(sample)).toBe(true);
      expect(sample.length).toBe(10);

      for (const val of sample) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });

    it('should check containment', () => {
      const space = new Box(0, 1, 'float32', [3]);
      expect(space.contains([0.5, 0.3, 0.8])).toBe(true);
      expect(space.contains([0.5, 1.5, 0.8])).toBe(false);
      expect(space.contains([0.5, 0.3])).toBe(false);
    });
  });

  describe('Discrete', () => {
    it('should create a discrete space', () => {
      const space = new Discrete(10);
      expect(space.n).toBe(10);
      expect(space.size).toBe(1);
    });

    it('should sample valid actions', () => {
      const space = new Discrete(5);
      const sample = space.sample();

      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThan(5);
    });

    it('should check containment', () => {
      const space = new Discrete(5);
      expect(space.contains(0)).toBe(true);
      expect(space.contains(4)).toBe(true);
      expect(space.contains(5)).toBe(false);
      expect(space.contains(-1)).toBe(false);
    });
  });

  describe('MultiDiscrete', () => {
    it('should create a multi-discrete space', () => {
      const space = new MultiDiscrete([2, 3, 4]);
      expect(space.nvec).toEqual([2, 3, 4]);
      expect(space.size).toBe(3);
    });

    it('should sample valid actions', () => {
      const space = new MultiDiscrete([2, 3, 4]);
      const sample = space.sample();

      expect(Array.isArray(sample)).toBe(true);
      expect(sample.length).toBe(3);
      expect(sample[0]).toBeGreaterThanOrEqual(0);
      expect(sample[0]).toBeLessThan(2);
    });
  });

  describe('MultiBinary', () => {
    it('should create a multi-binary space', () => {
      const space = new MultiBinary(10);
      expect(space.n).toBe(10);
      expect(space.size).toBe(10);
    });

    it('should sample binary values', () => {
      const space = new MultiBinary(5);
      const sample = space.sample();

      expect(Array.isArray(sample)).toBe(true);
      expect(sample.length).toBe(5);

      for (const val of sample) {
        expect([0, 1]).toContain(val);
      }
    });
  });

  describe('Dict', () => {
    it('should create a dict space', () => {
      const space = new Dict({
        action: new Discrete(3),
        velocity: new Box(0, 1, 'float32', [3]),
      });

      expect(space.spaces).toHaveProperty('action');
      expect(space.spaces).toHaveProperty('velocity');
    });

    it('should sample dict values', () => {
      const space = new Dict({
        action: new Discrete(3),
        velocity: new Box(0, 1, 'float32', [3]),
      });

      const sample = space.sample();

      expect(sample).toHaveProperty('action');
      expect(sample).toHaveProperty('velocity');
    });
  });

  describe('Tuple', () => {
    it('should create a tuple space', () => {
      const space = new Tuple([
        new Discrete(3),
        new Box(0, 1, 'float32', [2]),
      ]);

      expect(space.spaces).toHaveLength(2);
    });

    it('should sample tuple values', () => {
      const space = new Tuple([
        new Discrete(3),
        new Box(0, 1, 'float32', [2]),
      ]);

      const sample = space.sample();

      expect(Array.isArray(sample)).toBe(true);
      expect(sample).toHaveLength(2);
    });
  });
});

describe('ReplayBuffer', () => {
  it('should add and sample transitions', () => {
    const { ReplayBuffer } = require('../memory/replay-buffer');
    const buffer = new ReplayBuffer(100);

    const transition = {
      state: [1, 2, 3],
      action: 0,
      reward: 1.0,
      nextState: [2, 3, 4],
      terminated: false,
      truncated: false,
    };

    buffer.add(transition);
    expect(buffer.size).toBe(1);

    const samples = buffer.sample(1);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toEqual(transition);
  });

  it('should handle buffer overflow', () => {
    const { ReplayBuffer } = require('../memory/replay-buffer');
    const buffer = new ReplayBuffer(10);

    for (let i = 0; i < 20; i++) {
      buffer.add({
        state: [i],
        action: 0,
        reward: 0,
        nextState: null,
        terminated: true,
        truncated: false,
      });
    }

    expect(buffer.size).toBe(10);
  });
});
