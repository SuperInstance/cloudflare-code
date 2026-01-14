# GitHub Integration: Native Workflow for ClaudeFlare

## Overview

ClaudeFlare integrates deeply with GitHub to provide a native coding workflow. This includes Git LFS storage on R2, webhook-based automation, PR review, and code generation directly in repos. This document covers the complete integration architecture.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Git LFS on R2](#git-lfs-on-r2)
- [GitHub App Setup](#github-app-setup)
- [Webhook Handling](#webhook-handling)
- [PR Review Automation](#pr-review-automation)
- [Issue Triage](#issue-triage)
- [Code Generation Commits](#code-generation-commits)
- [Security & Scanning](#security--scanning)
- [Permissions Model](#permissions-model)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GITHUB INTEGRATION LAYER                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │  GitHub App  │◀──▶│  Webhooks    │◀──▶│  ClaudeFlare │     │
│  │  (OAuth)     │    │  (Events)    │    │  (Agents)    │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              GIT LFS ON R2                             │   │
│  │                                                         │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐               │   │
│  │  │ Pointer │  │ Upload  │  │  Download│               │   │
│  │  │ Files   │──▶│ Presigned│──▶│ from R2 │               │   │
│  │  │         │  │ URLs    │  │         │               │   │
│  │  └─────────┘  └─────────┘  └─────────┘               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              WORKFLOW AUTOMATION                       │   │
│  │                                                         │   │
│  │  PR Review │ Issue Triage │ Code Gen │ Security Scan   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Git LFS on R2

### Why Custom Git LFS Server?

- **Zero egress costs** on R2 (vs S3 charges)
- **10GB free storage**
- **Presigned URLs for secure uploads**
- **Full control over authentication**

### LFS Pointer File Format

```
version https://git-lfs.github.com/spec/v1
oid sha256:4d7a214614ab2935c943f9e0ff69d22eadbb4f32b1a3a7e...
size 12345678
```

### Custom LFS Server Implementation

```typescript
// workers/lfs/server.ts
export interface LFSEndpoint {
  operation: 'download' | 'upload' | 'verify';
  objects: Array<{
    oid: string;
    size: number;
  }>;
  transfer: 'basic' | 'multipart';
}

export class LFSServer {
  private r2: R2Bucket;
  private jwtSecret: string;

  async handleBatch(request: Request): Promise<Response> {
    const auth = this.authenticate(request);
    if (!auth) {
      return new Response('Unauthorized', { status: 401 });
    }

    const batch: LFSEndpoint = await request.json();
    const response = {
      transfer: 'basic' as const,
      objects: await Promise.all(
        batch.objects.map(async (obj) => {
          if (batch.operation === 'download') {
            return this.handleDownload(obj, auth.user);
          } else if (batch.operation === 'upload') {
            return this.handleUpload(obj, auth.user);
          }
          return {
            oid: obj.oid,
            size: obj.size,
            error: { code: 500, message: 'Invalid operation' },
          };
        })
      ),
    };

    return Response.json(response);
  }

  private async handleDownload(obj: { oid: string; size: number }, user: string) {
    // Check if object exists in R2
    const key = `lfs/${user}/${obj.oid.substring(0, 2)}/${obj.oid}`;

    const object = await this.r2.head(key);
    if (!object) {
      return {
        oid: obj.oid,
        size: obj.size,
        error: { code: 404, message: 'Object not found' },
      };
    }

    // Generate presigned URL (valid for 1 hour)
    const url = await this.r2.createPresignedUrl(key, {
      expiresIn: 3600,
    });

    return {
      oid: obj.oid,
      size: obj.size,
      actions: {
        download: {
          href: url,
          header: {
            'Content-Type': 'application/octet-stream',
          },
          expires_in: 3600,
        },
      },
    };
  }

  private async handleUpload(obj: { oid: string; size: number }, user: string) {
    // Check if object already exists
    const key = `lfs/${user}/${obj.oid.substring(0, 2)}/${obj.oid}`;

    const existing = await this.r2.head(key);
    if (existing) {
      return {
        oid: obj.oid,
        size: obj.size,
        actions: {
          download: {
            href: await this.r2.createPresignedUrl(key, { expiresIn: 3600 }),
            header: { 'Content-Type': 'application/octet-stream' },
            expires_in: 3600,
          },
        },
      };
    }

    // Generate presigned PUT URL (valid for 1 hour)
    const url = await this.r2.createPresignedUrl(key, {
      method: 'PUT',
      expiresIn: 3600,
    });

    return {
      oid: obj.oid,
      size: obj.size,
      actions: {
        upload: {
          href: url,
          header: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': obj.size.toString(),
          },
          expires_in: 3600,
        },
        verify: {
          href: `https://lfs.claudeflare.workers.dev/verify`,
          header: {
            'Content-Type': 'application/vnd.git-lfs+json',
          },
          expires_in: 3600,
        },
      },
    };
  }

  async handleVerify(request: Request): Promise<Response> {
    const auth = this.authenticate(request);
    if (!auth) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { oid, size } = await request.json();
    const key = `lfs/${auth.user}/${oid.substring(0, 2)}/${oid}`;

    const object = await this.r2.head(key);
    if (!object) {
      return Response.json({
        message: 'Object not found',
      }, { status: 404 });
    }

    if (object.size !== size) {
      return Response.json({
        message: 'Size mismatch',
      }, { status: 422 });
    }

    return Response.json({ ok: true });
  }

  private authenticate(request: Request): { user: string } | null {
    const auth = request.headers.get('Authorization');
    if (!auth) return null;

    // Verify JWT token
    const token = auth.replace('Bearer ', '');
    try {
      const payload = jwt.verify(token, this.jwtSecret) as { user: string };
      return { user: payload.user };
    } catch {
      return null;
    }
  }
}
```

### Git LFS Client Configuration

```bash
# .gitattributes
*.model filter=lfs diff=lfs merge=lfs -text
*.bin filter=lfs diff=lfs merge=lfs -text
*.large filter=lfs diff=lfs merge=lfs -text
```

```bash
# .lfsconfig
[lfs]
url = "https://lfs.claudeflare.workers.dev"
```

---

## GitHub App Setup

### App Manifest

```yaml
# .github/claudeflare-app-manifest.yaml
name: ClaudeFlare
description: AI-powered coding assistant with infinite context
url: https://claudeflare.workers.dev
hook_attributes:
  url: https://claudeflare.workers.dev/webhook
  webhook_secret: "${WEBHOOK_SECRET}"
public: false
default_permissions:
  contents: write
  pull_requests: write
  issues: write
  checks: write
  actions: read
default_events:
  - pull_request
  - pull_request_review
  - issue_comment
  - issues
  - push
  - check_run
  - check_suite
  - workflow_run
```

### OAuth Flow

```typescript
// workers/github/oauth.ts
export class GitHubOAuth {
  private clientId: string;
  private clientSecret: string;

  async handleRedirect(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/auth/github') {
      // Redirect to GitHub OAuth
      const authUrl = new URL('https://github.com/login/oauth/authorize');
      authUrl.searchParams.set('client_id', this.clientId);
      authUrl.searchParams.set('scope', 'repo,read:user,read:org');
      authUrl.searchParams.set('state', crypto.randomUUID());

      return Response.redirect(authUrl);
    }

    if (url.pathname === '/auth/github/callback') {
      // Handle GitHub callback
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Get user info
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      const user = await userResponse.json();

      // Generate JWT for session
      const jwt = await this.createSessionJWT(user);

      // Redirect to app
      return Response.redirect(`${url.origin}/?token=${jwt}`);
    }

    return new Response('Not found', { status: 404 });
  }

  private async createSessionJWT(user: any): Promise<string> {
    const payload = {
      user: user.login,
      name: user.name,
      avatar: user.avatar_url,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };

    return jwt.sign(payload, this.jwtSecret);
  }
}
```

---

## Webhook Handling

### Webhook Signature Verification

```typescript
// workers/github/webhook.ts
import * as crypto from 'crypto';

export class WebhookHandler {
  private webhookSecret: string;

  async handleWebhook(request: Request): Promise<Response> {
    // Verify signature
    const signature = request.headers.get('X-Hub-Signature-256');
    if (!signature) {
      return new Response('Missing signature', { status: 401 });
    }

    const body = await request.text();
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(body);
    const expected = `sha256=${hmac.digest('hex')}`;

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return new Response('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(body);
    const event = request.headers.get('X-GitHub-Event')!;

    // Route to appropriate handler
    switch (event) {
      case 'pull_request':
        return this.handlePullRequest(payload);
      case 'issue_comment':
        return this.handleIssueComment(payload);
      case 'issues':
        return this.handleIssue(payload);
      case 'push':
        return this.handlePush(payload);
      case 'check_run':
      case 'check_suite':
        return this.handleCheck(payload);
      default:
        return new Response('Unknown event', { status: 200 });
    }
  }

  private async handlePullRequest(payload: any): Promise<Response> {
    const { action, pull_request, repository } = payload;

    if (action === 'opened' || action === 'synchronize') {
      // Trigger PR review
      await this.triggerReview(pull_request, repository);
    }

    return new Response('OK', { status: 200 });
  }

  private async handleIssueComment(payload: any): Promise<Response> {
    const { comment, issue, repository } = payload;

    // Check if comment mentions @claudeflare
    if (comment.body.includes('@claudeflare')) {
      await this.handleCommand(comment.body, issue, repository);
    }

    return new Response('OK', { status: 200 });
  }
}
```

---

## PR Review Automation

### Automated Review Flow

```typescript
// workers/github/pr-review.ts
export class PRReviewAutomation {
  private github: GitHubAPI;
  private agents: AgentOrchestrator;

  async triggerReview(pr: any, repo: any): Promise<void> {
    // 1. Get PR diff
    const diff = await this.github.getDiff(pr);

    // 2. Analyze changes with agents
    const analysis = await this.agents.analyze({
      type: 'pr_review',
      diff,
      files: pr.changed_files,
      base: pr.base.sha,
      head: pr.head.sha,
    });

    // 3. Post review comment
    await this.github.createReviewComment(pr, analysis);

    // 4. Run security scan
    await this.runSecurityScan(pr, repo);

    // 5. Run tests
    await this.runTests(pr, repo);
  }

  private async createReviewComment(pr: any, analysis: any): Promise<void> {
    const comments = analysis.issues.map((issue: any) => ({
      path: issue.file,
      line: issue.line,
      body: `**${issue.severity}**: ${issue.message}\n\n${issue.suggestion}`,
    }));

    await this.github.post(`/repos/${pr.base.repo.full_name}/pulls/${pr.number}/comments`, {
      commit_id: pr.head.sha,
      comments,
      event: analysis.hasErrors ? 'REQUEST_CHANGES' : 'COMMENT',
    });
  }

  private async runSecurityScan(pr: any, repo: any): Promise<void> {
    // Get files
    const files = await this.github.getFiles(pr);

    // Scan for secrets
    const secrets = await this.scanForSecrets(files);

    if (secrets.length > 0) {
      await this.github.createReviewComment(pr, {
        body: `🚨 **Secrets detected!**\n\n${secrets.map(s => `- \`${s.type}\` in \`${s.file}\``).join('\n')}`,
        event: 'REQUEST_CHANGES',
      });
    }

    // Check for vulnerabilities
    const vulns = await this.checkDependencies(pr);

    if (vulns.length > 0) {
      await this.github.createReviewComment(pr, {
        body: `⚠️ **Vulnerabilities found**\n\n${vulns.map(v => `- \`${v.package}\`: ${v.severity} (${v.cvss})`).join('\n')}`,
        event: 'REQUEST_CHANGES',
      });
    }
  }

  private async scanForSecrets(files: File[]): Promise<Secret[]> {
    const secrets: Secret[] = [];

    for (const file of files) {
      const content = await file.content();

      // Check for common secret patterns
      const patterns = [
        { regex: /sk-[a-zA-Z0-9]{48}/, type: 'OpenAI API Key' },
        { regex: /ghp_[a-zA-Z0-9]{36}/, type: 'GitHub Personal Access Token' },
        { regex: /AKIA[0-9A-Z]{16}/, type: 'AWS Access Key' },
        { regex: /AIza[0-9A-Za-z\\-_]{35}/, type: 'Google API Key' },
        { regex: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/, type: 'Slack Bot Token' },
      ];

      for (const pattern of patterns) {
        const matches = content.matchAll(pattern.regex);
        for (const match of matches) {
          secrets.push({
            type: pattern.type,
            file: file.path,
            line: this.getLineNumber(content, match.index!),
            value: match[0],
          });
        }
      }
    }

    return secrets;
  }
}
```

### Interactive PR Chat

```typescript
// workers/github/pr-chat.ts
export class PRChat {
  async handleComment(pr: any, comment: string): Promise<void> {
    // Extract command
    const command = this.parseCommand(comment);

    switch (command.action) {
      case 'explain':
        await this.explainCode(pr, command.target);
        break;
      case 'fix':
        await this.suggestFix(pr, command.target);
        break;
      case 'test':
        await this.generateTests(pr, command.target);
        break;
      case 'refactor':
        await this.suggestRefactor(pr, command.target);
        break;
      case 'chat':
        await this.chat(pr, command.message);
        break;
    }
  }

  private async explainCode(pr: any, target: string): Promise<void> {
    const file = await this.github.getFile(pr, target);
    const content = await file.content();

    const explanation = await this.agents.explain({
      file: target,
      content,
      context: await this.getContext(pr),
    });

    await this.github.createComment(pr, {
      body: `## 📖 Code Explanation\n\n${explanation.summary}\n\n### Key Points\n${explanation.points.map(p => `- ${p}`).join('\n')}`,
    });
  }

  private async suggestFix(pr: any, target: string): Promise<void> {
    const file = await this.github.getFile(pr, target);
    const content = await file.content();

    const fix = await this.agents.fix({
      file: target,
      content,
      issues: await this.getIssues(pr, target),
    });

    // Create fix branch
    const branch = await this.github.createBranch(pr, `fix/${target.replace(/\//g, '-')}`);

    // Apply fix
    await this.github.createCommit(branch, {
      message: `Fix: ${fix.description}`,
      files: [{
        path: target,
        content: fix.code,
        mode: '100644',
      }],
    });

    // Comment with PR link
    await this.github.createComment(pr, {
      body: `## 🔧 Fix Suggested\n\n${fix.description}\n\n**Fix branch:** \`${branch}\`\n\n[Create PR](https://github.com/${pr.base.repo.full_name}/compare/${pr.base.ref}...${branch})`,
    });
  }

  private async chat(pr: any, message: string): Promise<void> {
    // Get PR context
    const context = await this.getContext(pr);

    // Get conversation history
    const history = await this.getConversationHistory(pr);

    // Generate response
    const response = await this.agents.chat({
      message,
      context,
      history,
    });

    // Post response
    await this.github.createComment(pr, {
      body: response.text,
    });

    // Update conversation history
    await this.updateConversationHistory(pr, {
      user: message,
      assistant: response.text,
    });
  }
}
```

---

## Issue Triage

### Automatic Issue Classification

```typescript
// workers/github/issue-triage.ts
export class IssueTriage {
  async handleIssue(issue: any): Promise<void> {
    // Classify issue
    const classification = await this.classify(issue);

    // Add labels
    await this.github.addLabels(issue, classification.labels);

    // Add assignee
    if (classification.assignee) {
      await this.github.assign(issue, classification.assignee);
    }

    // Post suggestions
    if (classification.suggestions) {
      await this.github.createComment(issue, {
        body: `## 🤖 AI Analysis\n\n${classification.suggestions}`,
      });
    }

    // Create project card
    await this.addToProject(issue, classification.project);
  }

  private async classify(issue: any): Promise<Classification> {
    // Use AI to classify
    const prompt = `
Classify this GitHub issue:

Title: ${issue.title}
Body: ${issue.body}
Labels: ${issue.labels.map((l: any) => l.name).join(', ')}

Return JSON with:
{
  "type": "bug|feature|question|documentation",
  "priority": "critical|high|medium|low",
  "complexity": "simple|medium|complex",
  "labels": ["label1", "label2"],
  "assignee": "username|null",
  "project": "project-name",
  "suggestions": "text"
}
`;

    const response = await this.ai.chat(prompt);
    return JSON.parse(response);
  }
}
```

---

## Code Generation Commits

### Direct Code Generation

```typescript
// workers/github/codegen.ts
export class CodeGenerator {
  async handleCodeGenCommand(issue: any, command: string): Promise<void> {
    // Parse command
    const parsed = this.parseCommand(command);

    // Generate code
    const code = await this.generate({
      description: parsed.description,
      files: parsed.files,
      context: await this.getContext(issue),
    });

    // Create branch
    const branchName = `feat/${parsed.name.toLowerCase().replace(/\s+/g, '-')}`;
    const branch = await this.github.createBranch(issue, branchName);

    // Commit code
    await this.github.createCommit(branch, {
      message: `feat: ${parsed.description}`,
      files: code.files,
    });

    // Create PR
    const pr = await this.github.createPR({
      base: issue.base.ref,
      head: branchName,
      title: parsed.name,
      body: `## Summary\n\n${parsed.description}\n\n## Generated by ClaudeFlare 🤖\n\nThis PR was automatically generated based on #${issue.number}.`,
    });

    // Comment on issue
    await this.github.createComment(issue, {
      body: `## ✅ Code Generated\n\nPR created: #${pr.number}\n\n[View PR](${pr.html_url})`,
    });
  }

  private async generate(input: GenerateInput): Promise<GeneratedCode> {
    const agents = await this.getAgents();

    const result = await agents.generate({
      task: input.description,
      files: input.files.map(f => ({
        path: f.path,
        content: f.content,
      })),
      context: input.context,
    });

    return {
      files: result.files.map(f => ({
        path: f.path,
        content: f.content,
        mode: '100644',
      })),
    };
  }
}
```

---

## Security & Scanning

### Dependency Vulnerability Scanning

```typescript
// workers/github/security.ts
export class SecurityScanner {
  async scanDependencies(pr: any): Promise<Vulnerability[]> {
    const files = await this.github.getFiles(pr, ['package.json', 'requirements.txt', 'go.mod', 'Cargo.toml']);

    const vulns: Vulnerability[] = [];

    for (const file of files) {
      const content = await file.content();

      if (file.path === 'package.json') {
        const pkg = JSON.parse(content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        for (const [name, version] of Object.entries(deps)) {
          const advisory = await this.checkNPMVulnerability(name, version as string);
          if (advisory) {
            vulns.push({
              package: name,
              version: version as string,
              severity: advisory.severity,
              cvss: advisory.cvss,
              url: advisory.url,
            });
          }
        }
      }
    }

    return vulns;
  }

  private async checkNPMVulnerability(name: string, version: string): Promise<Advisory | null> {
    const response = await fetch(`https://registry.npmjs.org/${name}`);
    const data = await response.json();

    if (data.advisories) {
      for (const advisory of Object.values(data.advisories)) {
        if (this.matchesVersion(version, advisory.vulnerable_versions)) {
          return advisory;
        }
      }
    }

    return null;
  }
}
```

---

## Permissions Model

### Repository-Level Permissions

```typescript
// workers/github/permissions.ts
export enum Permission {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
}

export class PermissionsManager {
  async checkPermission(user: string, repo: string, required: Permission): Promise<boolean> {
    // Get user's access level
    const access = await this.github.getRepoAccess(user, repo);

    const levels = {
      [Permission.READ]: ['pull', 'triage', 'push', 'maintain', 'admin'],
      [Permission.WRITE]: ['push', 'maintain', 'admin'],
      [Permission.ADMIN]: ['admin', 'maintain'],
    };

    return levels[required].includes(access);
  }

  async requirePermission(request: Request, repo: string, required: Permission): Promise<boolean> {
    const user = await this.getUserFromToken(request);
    if (!user) return false;

    const hasPermission = await this.checkPermission(user, repo, required);
    if (!hasPermission) {
      throw new Error(`Insufficient permissions: ${required} required`);
    }

    return true;
  }
}
```

---

## Summary

The GitHub integration provides:

| Feature | Implementation |
|---------|----------------|
| **Git LFS** | Custom server on R2 with presigned URLs |
| **OAuth** | GitHub App with JWT session tokens |
| **Webhooks** | Signature-verified event handling |
| **PR Review** | Automated analysis and comments |
| **Issue Triage** | AI-powered classification and labeling |
| **Code Generation** | Direct commits with generated code |
| **Security** | Secret scanning and vulnerability detection |
| **Permissions** | Repository-level access control |

**Key Benefits:**
- Native GitHub workflow
- Zero egress costs with R2
- Automated PR reviews
- AI-powered issue triage
- Direct code generation in repos
- Comprehensive security scanning

---

## References

- [GitHub Webhooks](https://docs.github.com/en/developers/webhooks-and-events/webhooks/about-webhooks)
- [Git LFS Specification](https://github.com/git-lfs/git-lfs/blob/main/docs/api/batch.md)
- [GitHub Apps](https://docs.github.com/en/developers/apps/building-github-apps)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
