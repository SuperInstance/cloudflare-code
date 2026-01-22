/**
 * Monorepo Detection and Analysis
 *
 * Detects and analyzes monorepo configurations in GitHub repositories
 * Supports npm, yarn, pnpm, lerna, turborepo, nx, rush, and custom configs
 */

import { GitHubClient } from './client';
import { MonorepoConfig, PackageInfo } from './types';

// ============================================================================
// Monorepo Detection
// ============================================================================

/**
 * Detect monorepo configuration in a repository
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch to analyze (default: default branch)
 * @returns Monorepo configuration or null if not a monorepo
 */
export async function detectMonorepo(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch?: string
): Promise<MonorepoConfig | null> {
  try {
    // Get root package.json
    const packageJson = await readFile(client, owner, repo, 'package.json', branch);
    const rootPackage = JSON.parse(packageJson.content) as Record<string, unknown>;

    // Check for workspaces (npm/yarn/pnpm)
    if (rootPackage.workspaces && Array.isArray(rootPackage.workspaces)) {
      const packageManager = await detectPackageManager(client, owner, repo, branch);
      return {
        type: packageManager === 'yarn' ? 'yarn' : packageManager === 'pnpm' ? 'pnpm' : 'npm',
        rootPackageJson: rootPackage,
        packages: rootPackage.workspaces as string[],
        packageManager,
        workspaces: rootPackage.workspaces as string[],
      };
    }

    // Check for yarn workspaces (old format)
    if (rootPackage.workspaces && typeof rootPackage.workspaces === 'object' && rootPackage.workspaces.packages) {
      const packages = rootPackage.workspaces.packages as string[];
      return {
        type: 'yarn',
        rootPackageJson: rootPackage,
        packages,
        packageManager: 'yarn',
        workspaces: packages,
      };
    }

    // Check for pnpm workspace
    const pnpmWorkspace = await readFileSafe(client, owner, repo, 'pnpm-workspace.yaml', branch);
    if (pnpmWorkspace) {
      const packages = parsePnpmWorkspace(pnpmWorkspace.content);
      return {
        type: 'pnpm',
        rootPackageJson: rootPackage,
        packages,
        packageManager: 'pnpm',
        workspaces: packages,
      };
    }

    // Check for lerna
    const lernaConfig = await readFileSafe(client, owner, repo, 'lerna.json', branch);
    if (lernaConfig) {
      const lerna = JSON.parse(lernaConfig.content) as { packages: string[] };
      return {
        type: 'lerna',
        rootPackageJson: rootPackage,
        packages: lerna.packages,
        packageManager: 'npm', // Lerna typically uses npm
        workspaces: lerna.packages,
      };
    }

    // Check for turborepo
    const turboConfig = await readFileSafe(client, owner, repo, 'turbo.json', branch);
    if (turboConfig) {
      // Turborepo uses workspaces - detect the workspace type
      const workspaceType = await detectWorkspaceType(client, owner, repo, branch);
      const packages = await getWorkspacePackages(client, owner, repo, branch);

      return {
        type: 'turborepo',
        rootPackageJson: rootPackage,
        packages,
        packageManager: await detectPackageManager(client, owner, repo, branch),
        workspaces: packages,
      };
    }

    // Check for nx
    const nxJson = await readFileSafe(client, owner, repo, 'nx.json', branch);
    if (nxJson) {
      const packages = await getNxPackages(client, owner, repo, branch);
      return {
        type: 'nx',
        rootPackageJson: rootPackage,
        packages,
        packageManager: await detectPackageManager(client, owner, repo, branch),
        workspaces: packages,
      };
    }

    // Check for rush
    const rushJson = await readFileSafe(client, owner, repo, 'rush.json', branch);
    if (rushJson) {
      const rush = JSON.parse(rushJson.content) as { projects: Array<{ packageName: string; projectFolder: string }> };
      const packages = rush.projects.map((p) => `${p.projectFolder}/`);

      return {
        type: 'rush',
        rootPackageJson: rootPackage,
        packages,
        packageManager: 'npm', // Rush uses npm internally
        workspaces: packages,
      };
    }

    // Not a monorepo
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// Package Manager Detection
// ============================================================================

/**
 * Detect package manager used in repository
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch to analyze
 * @returns Detected package manager
 */
export async function detectPackageManager(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch?: string
): Promise<'npm' | 'yarn' | 'pnpm' | 'bun'> {
  // Check for lock files
  const yarnLock = await fileExists(client, owner, repo, 'yarn.lock', branch);
  if (yarnLock) return 'yarn';

  const pnpmLock = await fileExists(client, owner, repo, 'pnpm-lock.yaml', branch);
  if (pnpmLock) return 'pnpm';

  const bunLockb = await fileExists(client, owner, repo, 'bun.lockb', branch);
  if (bunLockb) return 'bun';

  const packageLock = await fileExists(client, owner, repo, 'package-lock.json', branch);
  if (packageLock) return 'npm';

  // Default to npm if no lock file found
  return 'npm';
}

/**
 * Detect workspace type (npm, yarn, or pnpm)
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch to analyze
 * @returns Workspace type
 */
async function detectWorkspaceType(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch?: string
): Promise<'npm' | 'yarn' | 'pnpm'> {
  const pnpmWorkspace = await fileExists(client, owner, repo, 'pnpm-workspace.yaml', branch);
  if (pnpmWorkspace) return 'pnpm';

  const yarnLock = await fileExists(client, owner, repo, 'yarn.lock', branch);
  if (yarnLock) return 'yarn';

  return 'npm';
}

/**
 * Get workspace packages for npm/yarn/pnpm workspaces
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch to analyze
 * @returns List of workspace package paths
 */
async function getWorkspacePackages(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch?: string
): Promise<string[]> {
  try {
    const packageJson = await readFile(client, owner, repo, 'package.json', branch);
    const rootPackage = JSON.parse(packageJson.content) as { workspaces: string[] };

    if (Array.isArray(rootPackage.workspaces)) {
      return rootPackage.workspaces;
    }

    if (typeof rootPackage.workspaces === 'object' && rootPackage.workspaces.packages) {
      return rootPackage.workspaces.packages as string[];
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Get packages for nx workspace
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch to analyze
 * @returns List of workspace package paths
 */
async function getNxPackages(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch?: string
): Promise<string[]> {
  try {
    // Try to get project configuration
    const projectJson = await readFileSafe(client, owner, repo, 'project.json', branch);
    if (projectJson) {
      const project = JSON.parse(projectJson.content) as Record<string, unknown>;
      // Extract project paths from nx config
      // This is a simplified implementation
      return ['**/packages/*'];
    }

    return ['**/packages/*', '**/apps/*'];
  } catch {
    return ['**/packages/*', '**/apps/*'];
  }
}

// ============================================================================
// Package Discovery
// ============================================================================

/**
 * List all packages in a monorepo
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param config - Monorepo configuration
 * @param branch - Branch to analyze
 * @returns List of package information
 */
export async function listMonorepoPackages(
  client: GitHubClient,
  owner: string,
  repo: string,
  config: MonorepoConfig,
  branch?: string
): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  // For each workspace pattern, find matching packages
  for (const pattern of config.packages) {
    const matchedPackages = await findPackagesByPattern(client, owner, repo, pattern, branch);
    packages.push(...matchedPackages);
  }

  return packages;
}

/**
 * Find packages matching a workspace pattern
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param pattern - Workspace pattern (e.g., 'packages/*')
 * @param branch - Branch to analyze
 * @returns List of package information
 */
async function findPackagesByPattern(
  client: GitHubClient,
  owner: string,
  repo: string,
  pattern: string,
  branch?: string
): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  // Convert glob pattern to path
  // Simplified implementation - handle basic patterns like 'packages/*'
  const basePath = pattern.replace('*', '');

  try {
    // Try to list directory contents
    const contents = await client.request<Array<{ name: string; type: string; path: string }>>(
      `/repos/${owner}/${repo}/contents/${basePath}${branch ? `?ref=${branch}` : ''}`
    );

    for (const item of contents) {
      if (item.type === 'dir') {
        // Check if directory has package.json
        try {
          const packageJsonPath = `${basePath}${item.name}/package.json`;
          const packageJson = await readFile(client, owner, repo, packageJsonPath, branch);
          const packageData = JSON.parse(packageJson.content) as {
            name: string;
            version: string;
            private?: boolean;
            scripts?: Record<string, string>;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };

          packages.push({
            name: packageData.name,
            path: `${basePath}${item.name}`,
            version: packageData.version,
            private: packageData.private,
            scripts: packageData.scripts,
            dependencies: packageData.dependencies,
            devDependencies: packageData.devDependencies,
            workspacePath: item.name,
          });
        } catch {
          // No package.json in this directory, skip
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be accessed
  }

  return packages;
}

/**
 * Get package information
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param packagePath - Path to package
 * @param branch - Branch to analyze
 * @returns Package information
 */
export async function getPackageInfo(
  client: GitHubClient,
  owner: string,
  repo: string,
  packagePath: string,
  branch?: string
): Promise<PackageInfo | null> {
  try {
    const packageJsonPath = `${packagePath}/package.json`;
    const packageJson = await readFile(client, owner, repo, packageJsonPath, branch);
    const packageData = JSON.parse(packageJson.content) as {
      name: string;
      version: string;
      private?: boolean;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return {
      name: packageData.name,
      path: packagePath,
      version: packageData.version,
      private: packageData.private,
      scripts: packageData.scripts,
      dependencies: packageData.dependencies,
      devDependencies: packageData.devDependencies,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Dependency Analysis
// ============================================================================

/**
 * Build dependency graph for monorepo
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param packages - List of packages
 * @returns Dependency graph
 */
export async function buildDependencyGraph(
  client: GitHubClient,
  owner: string,
  repo: string,
  packages: PackageInfo[]
): Promise<Map<string, Set<string>>> {
  const graph = new Map<string, Set<string>>();

  // Create a set of all package names
  const packageNames = new Set(packages.map((p) => p.name));

  // Build graph
  for (const pkg of packages) {
    const dependencies = new Set<string>();

    // Check all dependencies
    if (pkg.dependencies) {
      for (const [name] of Object.entries(pkg.dependencies)) {
        if (packageNames.has(name)) {
          dependencies.add(name);
        }
      }
    }

    // Check dev dependencies
    if (pkg.devDependencies) {
      for (const [name] of Object.entries(pkg.devDependencies)) {
        if (packageNames.has(name)) {
          dependencies.add(name);
        }
      }
    }

    graph.set(pkg.name, dependencies);
  }

  return graph;
}

/**
 * Get packages that depend on a given package
 *
 * @param graph - Dependency graph
 * @param packageName - Package name
 * @returns List of dependent packages
 */
export function getDependents(
  graph: Map<string, Set<string>>,
  packageName: string
): string[] {
  const dependents: string[] = [];

  for (const [pkg, deps] of graph.entries()) {
    if (deps.has(packageName)) {
      dependents.push(pkg);
    }
  }

  return dependents;
}

/**
 * Get all transitive dependencies of a package
 *
 * @param graph - Dependency graph
 * @param packageName - Package name
 * @returns Set of transitive dependencies
 */
export function getTransitiveDependencies(
  graph: Map<string, Set<string>>,
  packageName: string
): Set<string> {
  const visited = new Set<string>();
  const dependencies = new Set<string>();

  function traverse(name: string) {
    if (visited.has(name)) return;
    visited.add(name);

    const deps = graph.get(name);
    if (deps) {
      for (const dep of deps) {
        dependencies.add(dep);
        traverse(dep);
      }
    }
  }

  traverse(packageName);
  return dependencies;
}

/**
 * Topological sort of packages (build order)
 *
 * @param graph - Dependency graph
 * @returns Sorted list of package names
 */
export function topologicalSort(graph: Map<string, Set<string>>): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(packageName: string) {
    if (visited.has(packageName)) return;
    if (visiting.has(packageName)) {
      throw new Error(`Circular dependency detected involving ${packageName}`);
    }

    visiting.add(packageName);

    const deps = graph.get(packageName);
    if (deps) {
      for (const dep of deps) {
        visit(dep);
      }
    }

    visiting.delete(packageName);
    visited.add(packageName);
    sorted.push(packageName);
  }

  for (const packageName of graph.keys()) {
    visit(packageName);
  }

  return sorted;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Read file from repository
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param branch - Git reference
 * @returns File content with metadata
 */
async function readFile(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<{ content: string; sha: string }> {
  const file = await client.getFile(owner, repo, path, branch);

  if (file.type !== 'file') {
    throw new Error(`Path ${path} is not a file`);
  }

  return {
    content: file.decodedContent,
    sha: file.sha,
  };
}

/**
 * Read file safely (returns null if not found)
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param branch - Git reference
 * @returns File content or null
 */
async function readFileSafe(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<{ content: string; sha: string } | null> {
  try {
    return await readFile(client, owner, repo, path, branch);
  } catch {
    return null;
  }
}

/**
 * Check if file exists
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param branch - Git reference
 * @returns True if file exists
 */
async function fileExists(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<boolean> {
  try {
    await client.getFile(owner, repo, path, branch);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse pnpm workspace.yaml
 *
 * @param content - File content
 * @returns List of workspace packages
 */
function parsePnpmWorkspace(content: string): string[] {
  const packages: string[] = [];

  // Simple YAML parser for pnpm-workspace.yaml
  const lines = content.split('\n');
  let inPackages = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('packages:')) {
      inPackages = true;
      continue;
    }

    if (inPackages) {
      if (trimmed.startsWith('-')) {
        packages.push(trimmed.slice(1).trim());
      } else if (trimmed && !trimmed.startsWith('#')) {
        // End of packages list
        break;
      }
    }
  }

  return packages;
}

/**
 * Detect changed packages in a monorepo
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param baseSha - Base commit SHA
 * @param headSha - Head commit SHA
 * @param packages - List of packages
 * @returns List of changed package paths
 */
export async function detectChangedPackages(
  client: GitHubClient,
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
  packages: PackageInfo[]
): Promise<string[]> {
  const changedPaths = new Set<string>();

  try {
    // Get comparison
    const comparison = await client.compareCommits(owner, repo, baseSha, headSha);

    // Check each file
    for (const file of comparison.files) {
      // Find which package this file belongs to
      for (const pkg of packages) {
        if (file.filename.startsWith(pkg.path)) {
          changedPaths.add(pkg.path);
          break;
        }
      }
    }
  } catch {
    // If comparison fails, assume all packages changed
    return packages.map((p) => p.path);
  }

  return Array.from(changedPaths);
}

/**
 * Calculate build order for changed packages
 *
 * @param changedPackages - List of changed package paths
 * @param graph - Dependency graph
 * @param packages - List of all packages
 * @returns Build order (package paths)
 */
export function calculateBuildOrder(
  changedPackages: string[],
  graph: Map<string, Set<string>>,
  packages: PackageInfo[]
): string[] {
  // Create a map of paths to names
  const pathToName = new Map<string, string>();
  for (const pkg of packages) {
    pathToName.set(pkg.path, pkg.name);
  }

  // Get names of changed packages
  const changedNames = new Set(
    changedPackages.map((path) => pathToName.get(path)).filter((n) => n !== undefined) as string[]
  );

  // Get all transitive dependencies of changed packages
  const toBuild = new Set<string>();
  for (const name of changedNames) {
    toBuild.add(name);
    const deps = getTransitiveDependencies(graph, name);
    for (const dep of deps) {
      toBuild.add(dep);
    }
  }

  // Topological sort
  const sortedNames = topologicalSort(graph);

  // Filter to only packages we need to build
  const buildOrder = sortedNames.filter((name) => toBuild.has(name));

  // Convert back to paths
  const nameToPath = new Map<string, string>();
  for (const pkg of packages) {
    nameToPath.set(pkg.name, pkg.path);
  }

  return buildOrder.map((name) => nameToPath.get(name)!).filter((p) => p !== undefined);
}
