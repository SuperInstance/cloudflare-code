/**
 * GitHub Git Operations
 *
 * High-level Git operations using the GitHub API
 * Handles cloning, branching, committing, and more
 */

import { GitHubClient } from './client';
import {
  GitCommit,
  GitTree,
  GitReference,
  GitHubRepository,
  GitHubContent,
  CreateBranchOptions,
  CommitOptions,
} from './types';

// ============================================================================
// Tree and Blob Operations
// ============================================================================

/**
 * Create a tree blob
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param content - File content
 * @param encoding - Content encoding
 * @returns Created blob SHA
 */
export async function createBlob(
  client: GitHubClient,
  owner: string,
  repo: string,
  content: string,
  encoding: 'utf-8' | 'base64' = 'utf-8'
): Promise<string> {
  const blobContent = encoding === 'utf-8' ? btoa(content) : content;

  const response = await client.request<{ sha: string }>(`/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    body: {
      content: blobContent,
      encoding: 'base64',
    },
  });

  return response.sha;
}

/**
 * Create a tree
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param treeItems - Tree items
 * @param baseTree - Base tree SHA (optional)
 * @returns Created tree SHA
 */
export async function createTree(
  client: GitHubClient,
  owner: string,
  repo: string,
  treeItems: Array<{
    path: string;
    mode: '100644' | '100755' | '040000' | '160000' | '120000';
    type: 'blob' | 'tree' | 'commit';
    sha?: string;
    content?: string;
  }>,
  baseTree?: string
): Promise<string> {
  // Create blobs for any items with content
  const processedItems = await Promise.all(
    treeItems.map(async (item) => {
      if (item.content && !item.sha) {
        const sha = await createBlob(client, owner, repo, item.content, 'utf-8');
        return { ...item, sha };
      }
      return item;
    })
  );

  const body: Record<string, unknown> = {
    tree: processedItems.map(({ path, mode, type, sha }) => ({
      path,
      mode,
      type,
      sha,
    })),
  };

  if (baseTree) {
    body.base_tree = baseTree;
  }

  const response = await client.request<{ sha: string }>(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body,
  });

  return response.sha;
}

/**
 * Get a tree recursively
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param treeSha - Tree SHA
 * @returns Recursive tree
 */
export async function getTreeRecursive(
  client: GitHubClient,
  owner: string,
  repo: string,
  treeSha: string
): Promise<GitTree> {
  return client.request<GitTree>(
    `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`
  );
}

// ============================================================================
// Branch Operations
// ============================================================================

/**
 * Create a new branch
 *
 * @param client - GitHub client
 * @param options - Branch creation options
 * @returns Created branch reference
 */
export async function createBranch(
  client: GitHubClient,
  options: CreateBranchOptions
): Promise<GitReference> {
  const { owner, repo, branch, fromBranch, fromSha } = options;

  // Get source SHA
  let sourceSha: string;

  if (fromSha) {
    sourceSha = fromSha;
  } else if (fromBranch) {
    const sourceRef = await client.getReference(owner, repo, `heads/${fromBranch}`);
    sourceSha = sourceRef.object.sha;
  } else {
    throw new Error('Either fromBranch or fromSha must be provided');
  }

  // Create new branch
  return client.createReference(owner, repo, `refs/heads/${branch}`, sourceSha);
}

/**
 * Delete a branch
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 */
export async function deleteBranch(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch: string
): Promise<void> {
  await client.deleteReference(owner, repo, `heads/${branch}`);
}

/**
 * Get default branch
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Default branch name
 */
export async function getDefaultBranch(
  client: GitHubClient,
  owner: string,
  repo: string
): Promise<string> {
  const repository = await client.getRepository(owner, repo);
  return repository.default_branch;
}

// ============================================================================
// Commit Operations
// ============================================================================

/**
 * Create a commit with multiple file changes
 *
 * @param client - GitHub client
 * @param options - Commit options
 * @returns Created commit
 */
export async function createCommit(
  client: GitHubClient,
  options: CommitOptions
): Promise<GitCommit> {
  const { owner, repo, branch, message, files } = options;

  // Get the current branch reference
  const branchRef = await client.getReference(owner, repo, `heads/${branch}`);
  const latestCommitSha = branchRef.object.sha;

  // Get the latest commit to get its tree
  const latestCommit = await client.getCommit(owner, repo, latestCommitSha);
  const baseTreeSha = latestCommit.tree.sha;

  // Create tree items for each file
  const treeItems = files.map((file) => ({
    path: file.path,
    mode: '100644' as const, // Regular file
    type: 'blob' as const,
    content: file.content,
  }));

  // Create new tree
  const newTreeSha = await createTree(client, owner, repo, treeItems, baseTreeSha);

  // Create new commit
  const newCommit = await client.createCommit(
    owner,
    repo,
    message,
    newTreeSha,
    [latestCommitSha]
  );

  // Update branch reference
  await client.updateReference(owner, repo, `heads/${branch}`, newCommit.sha);

  return newCommit;
}

/**
 * Amend the most recent commit
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @param files - Files to change
 * @returns Amended commit
 */
export async function amendCommit(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string }>
): Promise<GitCommit> {
  // Get the current branch reference
  const branchRef = await client.getReference(owner, repo, `heads/${branch}`);
  const latestCommitSha = branchRef.object.sha;

  // Get the latest commit
  const latestCommit = await client.getCommit(owner, repo, latestCommitSha);

  // Create new tree
  const treeItems = files.map((file) => ({
    path: file.path,
    mode: '100644' as const,
    type: 'blob' as const,
    content: file.content,
  }));

  const newTreeSha = await createTree(
    client,
    owner,
    repo,
    treeItems,
    latestCommit.tree.sha
  );

  // Create new commit with same parent(s)
  const parents = latestCommit.parents.map((p) => p.sha);
  const newCommit = await client.createCommit(
    owner,
    repo,
    latestCommit.commit.message,
    newTreeSha,
    parents
  );

  // Update branch reference
  await client.updateReference(owner, repo, `heads/${branch}`, newCommit.sha);

  return newCommit;
}

/**
 * Revert a commit
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param commitSha - Commit SHA to revert
 * @param branch - Branch to create revert commit on
 * @returns Revert commit
 */
export async function revertCommit(
  client: GitHubClient,
  owner: string,
  repo: string,
  commitSha: string,
  branch: string
): Promise<GitCommit> {
  // Get the commit to revert
  const commitToRevert = await client.getCommit(owner, repo, commitSha);

  // Get the current branch
  const branchRef = await client.getReference(owner, repo, `heads/${branch}`);

  // GitHub API v3 doesn't have a native revert endpoint
  // We need to use the REST API to create a revert
  const response = await client.request<GitCommit>(
    `/repos/${owner}/${repo}/commits/${commitSha}/revert`,
    {
      method: 'POST',
      body: {
        branch,
      },
    }
  );

  return response;
}

/**
 * Cherry-pick a commit
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param commitSha - Commit SHA to cherry-pick
 * @param targetBranch - Target branch
 * @returns Cherry-picked commit
 */
export async function cherryPickCommit(
  client: GitHubClient,
  owner: string,
  repo: string,
  commitSha: string,
  targetBranch: string
): Promise<GitCommit> {
  // Get the commit to cherry-pick
  const commitToPick = await client.getCommit(owner, repo, commitSha);

  // Get the target branch
  const targetRef = await client.getReference(owner, repo, `heads/${targetBranch}`);
  const targetCommit = await client.getCommit(owner, repo, targetRef.object.sha);

  // Apply the changes from the cherry-picked commit to the target branch
  // This is a simplified implementation - full cherry-pick requires merge logic
  const treeItems: Array<{
    path: string;
    mode: '100644' | '100755' | '040000' | '160000' | '120000';
    type: 'blob' | 'tree' | 'commit';
    sha: string;
  }> = [];

  // Get the tree for the commit being cherry-picked
  const tree = await getTreeRecursive(client, owner, repo, commitToPick.tree.sha);

  // Add all tree items
  for (const item of tree.tree) {
    if (item.type === 'blob') {
      treeItems.push({
        path: item.path,
        mode: item.mode as '100644' | '100755' | '040000' | '160000' | '120000',
        type: 'blob',
        sha: item.sha,
      });
    }
  }

  // Create new tree
  const newTreeSha = await createTree(
    client,
    owner,
    repo,
    treeItems,
    targetCommit.tree.sha
  );

  // Create commit
  const newCommit = await client.createCommit(
    owner,
    repo,
    `cherry-pick: ${commitToPick.commit.message}`,
    newTreeSha,
    [targetRef.object.sha]
  );

  // Update target branch
  await client.updateReference(owner, repo, `heads/${targetBranch}`, newCommit.sha);

  return newCommit;
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Read a file from a repository
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param ref - Git reference (branch, tag, or commit)
 * @returns File content with metadata
 */
export async function readFile(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<{ content: string; sha: string; size: number }> {
  const file = await client.getFile(owner, repo, path, ref);

  if (file.type !== 'file') {
    throw new Error(`Path ${path} is not a file`);
  }

  return {
    content: file.decodedContent,
    sha: file.sha,
    size: file.size,
  };
}

/**
 * Write a file to a repository
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param content - File content
 * @param message - Commit message
 * @param branch - Branch name
 * @returns Commit information
 */
export async function writeFile(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string
): Promise<{ content: GitHubContent; commit: GitCommit }> {
  // Try to get existing file
  let existingFile: GitHubContent | null = null;

  try {
    existingFile = await client.getFile(owner, repo, path, branch);
  } catch {
    // File doesn't exist, create new
  }

  if (existingFile && existingFile.type === 'file') {
    // Update existing file
    return client.createOrUpdateFile(owner, repo, path, content, message, existingFile.sha, branch);
  } else {
    // Create new file
    return client.createOrUpdateFile(owner, repo, path, content, message, undefined, branch);
  }
}

/**
 * Delete a file from a repository
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param message - Commit message
 * @param branch - Branch name
 * @returns Commit information
 */
export async function deleteFile(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  message: string,
  branch?: string
): Promise<{ commit: GitCommit }> {
  // Get file to get its SHA
  const file = await client.getFile(owner, repo, path, branch);

  if (file.type !== 'file') {
    throw new Error(`Path ${path} is not a file`);
  }

  return client.deleteFile(owner, repo, path, message, file.sha, branch);
}

/**
 * Move/rename a file in a repository
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param oldPath - Old file path
 * @param newPath - New file path
 * @param message - Commit message
 * @param branch - Branch name
 * @returns Commit information
 */
export async function moveFile(
  client: GitHubClient,
  owner: string,
  repo: string,
  oldPath: string,
  newPath: string,
  message: string,
  branch?: string
): Promise<{ content: GitHubContent; commit: GitCommit }> {
  // Read old file
  const oldFile = await readFile(client, owner, repo, oldPath, branch);

  // Write to new path
  const result = await writeFile(client, owner, repo, newPath, oldFile.content, message, branch);

  // Delete old file
  await deleteFile(client, owner, repo, oldPath, message, branch);

  return result;
}

/**
 * List directory contents
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - Directory path
 * @param ref - Git reference
 * @returns Directory contents
 */
export async function listDirectory(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<Array<{ name: string; path: string; type: string; size: number }>> {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const contents = await client.request<GitHubContent[]>(
    `/repos/${owner}/${repo}/contents/${path}${query}`
  );

  return contents.map((item) => ({
    name: item.name,
    path: item.path,
    type: item.type,
    size: item.size,
  }));
}

/**
 * Get file or directory at path
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - Path
 * @param ref - Git reference
 * @returns File or directory content
 */
export async function getPath(
  client: GitHubClient,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<GitHubContent | GitHubContent[]> {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  return client.request<GitHubContent | GitHubContent[]>(
    `/repos/${owner}/${repo}/contents/${path}${query}`
  );
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Commit multiple files at once
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @param message - Commit message
 * @param files - Files to commit
 * @returns Created commit
 */
export async function commitMultipleFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: Array<{ path: string; content: string }>
): Promise<GitCommit> {
  return createCommit(client, {
    owner,
    repo,
    branch,
    message,
    files,
  });
}

/**
 * Apply multiple file changes in a single commit
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 * @param message - Commit message
 * @param changes - Changes to apply (create, update, delete)
 * @returns Created commit
 */
export async function applyChanges(
  client: GitHubClient,
  owner: string,
  repo: string,
  branch: string,
  message: string,
  changes: {
    creates?: Array<{ path: string; content: string }>;
    updates?: Array<{ path: string; content: string }>;
    deletes?: Array<{ path: string }>;
  }
): Promise<GitCommit> {
  const files: Array<{ path: string; content: string }> = [];

  // Handle creates
  if (changes.creates) {
    for (const file of changes.creates) {
      files.push(file);
    }
  }

  // Handle updates
  if (changes.updates) {
    for (const file of changes.updates) {
      // For updates, we need to get the existing content and replace it
      const existing = await readFile(client, owner, repo, file.path, branch);
      files.push({
        path: file.path,
        content: file.content,
      });
    }
  }

  // Handle deletes - we need to exclude these from the tree
  // This requires getting the current tree and removing the deleted files
  if (changes.deletes && changes.deletes.length > 0) {
    // Get current branch
    const branchRef = await client.getReference(owner, repo, `heads/${branch}`);
    const latestCommit = await client.getCommit(owner, repo, branchRef.object.sha);
    const currentTree = await getTreeRecursive(client, owner, repo, latestCommit.tree.sha);

    // Build tree excluding deleted files
    const deletedPaths = new Set(changes.deletes.map((d) => d.path));
    for (const item of currentTree.tree) {
      if (item.type === 'blob' && !deletedPaths.has(item.path)) {
        // Get file content
        const file = await readFile(client, owner, repo, item.path, branch);
        files.push({
          path: item.path,
          content: file.content,
        });
      }
    }
  }

  return createCommit(client, {
    owner,
    repo,
    branch,
    message,
    files,
  });
}

// ============================================================================
// Diff Operations
// ============================================================================

/**
 * Get diff between two commits
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param base - Base commit SHA
 * @param head - Head commit SHA
 * @returns Comparison result with files changed
 */
export async function getDiff(
  client: GitHubClient,
  owner: string,
  repo: string,
  base: string,
  head: string
): Promise<{
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch: string;
  }>;
  commitCount: number;
}> {
  const comparison = await client.compareCommits(owner, repo, base, head);

  return {
    files: comparison.files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    })),
    commitCount: comparison.total_commits,
  };
}

// ============================================================================
// Repository Operations
// ============================================================================

/**
 * Fork a repository
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param organization - Organization to fork to (optional)
 * @returns Forked repository
 */
export async function forkRepository(
  client: GitHubClient,
  owner: string,
  repo: string,
  organization?: string
): Promise<GitHubRepository> {
  const body: Record<string, unknown> = {};

  if (organization) {
    body.organization = organization;
  }

  return client.request<GitHubRepository>(`/repos/${owner}/${repo}/forks`, {
    method: 'POST',
    body,
  });
}

/**
 * Get repository archive (tarball)
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param ref - Git reference
 * @returns Archive URL
 */
export async function getTarballUrl(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref?: string
): Promise<string> {
  return client.getArchiveLink(owner, repo, 'tarball', ref);
}

/**
 * Get repository archive (zipball)
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param ref - Git reference
 * @returns Archive URL
 */
export async function getZipballUrl(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref?: string
): Promise<string> {
  return client.getArchiveLink(owner, repo, 'zipball', ref);
}

// ============================================================================
// Tag Operations
// ============================================================================

/**
 * Create a tag
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param tag - Tag name
 * @param message - Tag message
 * @param objectSha - Object SHA to tag
 * @param type - Object type
 * @returns Created tag reference
 */
export async function createTag(
  client: GitHubClient,
  owner: string,
  repo: string,
  tag: string,
  message: string,
  objectSha: string,
  type: 'commit' | 'tree' | 'blob' = 'commit'
): Promise<GitReference> {
  // Create tag object
  const tagResponse = await client.request<{ sha: string }>(`/repos/${owner}/${repo}/git/tags`, {
    method: 'POST',
    body: {
      tag,
      message,
      object: objectSha,
      type,
    },
  });

  // Create tag reference
  return client.createReference(owner, repo, `refs/tags/${tag}`, tagResponse.sha);
}

/**
 * List tags
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param page - Page number
 * @param perPage - Results per page
 * @returns List of tag references
 */
export async function listTags(
  client: GitHubClient,
  owner: string,
  repo: string,
  page: number = 1,
  perPage: number = 30
): Promise<GitReference[]> {
  return client.request<GitReference[]>(
    `/repos/${owner}/${repo}/tags?page=${page}&per_page=${perPage}`
  );
}

/**
 * Delete a tag
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param tag - Tag name
 */
export async function deleteTag(
  client: GitHubClient,
  owner: string,
  repo: string,
  tag: string
): Promise<void> {
  await client.deleteReference(owner, repo, `tags/${tag}`);
}

// ============================================================================
// Release Operations
// ============================================================================

/**
 * Create a release
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param tagName - Tag name
 * @param name - Release name
 * @param body - Release description
 * @param draft - Draft release
 * @param prerelease - Pre-release
 * @returns Created release
 */
export async function createRelease(
  client: GitHubClient,
  owner: string,
  repo: string,
  tagName: string,
  name: string,
  body: string,
  draft: boolean = false,
  prerelease: boolean = false
): Promise<{
  id: number;
  tagName: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  htmlUrl: string;
}> {
  const response = await client.request<{
    id: number;
    tag_name: string;
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
    html_url: string;
  }>(`/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    body: {
      tag_name: tagName,
      name,
      body,
      draft,
      prerelease,
    },
  });

  return {
    id: response.id,
    tagName: response.tag_name,
    name: response.name,
    body: response.body,
    draft: response.draft,
    prerelease: response.prerelease,
    htmlUrl: response.html_url,
  };
}

/**
 * List releases
 *
 * @param client - GitHub client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param page - Page number
 * @param perPage - Results per page
 * @returns List of releases
 */
export async function listReleases(
  client: GitHubClient,
  owner: string,
  repo: string,
  page: number = 1,
  perPage: number = 30
): Promise<Array<{
  id: number;
  tagName: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  createdAt: string;
  publishedAt: string;
  htmlUrl: string;
}>> {
  const response = await client.request<
    Array<{
      id: number;
      tag_name: string;
      name: string;
      draft: boolean;
      prerelease: boolean;
      created_at: string;
      published_at: string;
      html_url: string;
    }>
  >(`/repos/${owner}/${repo}/releases?page=${page}&per_page=${perPage}`);

  return response.map((release) => ({
    id: release.id,
    tagName: release.tag_name,
    name: release.name,
    draft: release.draft,
    prerelease: release.prerelease,
    createdAt: release.created_at,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
  }));
}
