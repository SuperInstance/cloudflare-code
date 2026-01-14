/**
 * Seed runner for executing seed operations
 */

import type { SeedContext, Seeder, SeedResult } from './types';

export interface SeedRunnerOptions {
  context: SeedContext;
  seeders: Seeder[];
  stopOnError?: boolean;
  specificSeeders?: string[];
}

/**
 * Seed runner with dependency resolution
 */
export class SeedRunner {
  private readonly seeders: Map<string, Seeder>;
  private readonly context: SeedContext;

  constructor(options: SeedRunnerOptions) {
    this.seeders = new Map();
    this.context = options.context;

    for (const seeder of options.seeders) {
      this.seeders.set(seeder.name, seeder);
    }
  }

  /**
   * Run all seeders or specific ones
   */
  async run(options?: { specific?: string[]; stopOnError?: boolean }): Promise<SeedResult[]> {
    const specific = options?.specific;
    const stopOnError = options?.stopOnError ?? true;

    let seedersToRun: Seeder[];

    if (specific && specific.length > 0) {
      seedersToRun = this.resolveDependencies(specific);
    } else {
      seedersToRun = this.topologicalSort();
    }

    console.log(`\n🌱 Seeding: ${seedersToRun.length} seeder(s) to run\n`);

    const results: SeedResult[] = [];

    for (const seeder of seedersToRun) {
      console.log(`  ⏭️  [SEED] ${seeder.name} -> ${seeder.tableName}...`);

      const result = await seeder.run(this.context);
      results.push(result);

      if (result.success) {
        console.log(
          `  ✅ Inserted ${result.rowsInserted} rows in ${result.duration}ms\n`
        );
      } else {
        console.log(`  ❌ Failed: ${result.error}\n`);

        if (stopOnError) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Get seeder status
   */
  getStatus(): Array<{
    name: string;
    tableName: string;
    description?: string;
    dependsOn: string[];
  }> {
    return Array.from(this.seeders.values()).map((seeder) => ({
      name: seeder.name,
      tableName: seeder.tableName,
      description: seeder.description,
      dependsOn: seeder.dependsOn
    }));
  }

  /**
   * Sort seeders topologically based on dependencies
   */
  private topologicalSort(): Seeder[] {
    const sorted: Seeder[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) {
        return;
      }

      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected in seeder: ${name}`);
      }

      visiting.add(name);

      const seeder = this.seeders.get(name);
      if (seeder) {
        for (const dep of seeder.dependsOn) {
          visit(dep);
        }
      }

      visiting.delete(name);
      visited.add(name);

      if (seeder) {
        sorted.push(seeder);
      }
    };

    for (const name of this.seeders.keys()) {
      visit(name);
    }

    // Sort by order
    return sorted.sort((a, b) => a.order - b.order);
  }

  /**
   * Resolve dependencies for specific seeders
   */
  private resolveDependencies(names: string[]): Seeder[] {
    const toRun = new Set<string>();
    const resolved = new Set<string>();

    const resolve = (name: string) => {
      if (resolved.has(name)) {
        return;
      }

      const seeder = this.seeders.get(name);
      if (!seeder) {
        throw new Error(`Seeder not found: ${name}`);
      }

      toRun.add(name);

      for (const dep of seeder.dependsOn) {
        resolve(dep);
      }

      resolved.add(name);
    };

    for (const name of names) {
      resolve(name);
    }

    return this.topologicalSort().filter((s) => toRun.has(s.name));
  }
}
