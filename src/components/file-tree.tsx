/**
 * File Tree Component
 *
 * Features:
 * - Hierarchical file structure display
 * - File locking indicators and status
 * - File operations (create, edit, delete)
 * - Drag and drop support
 * - Search functionality
 * - Ad integration on sides
 */

import { html } from 'hono/html';
import { Hono } from 'hono';

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  size?: number;
  modified?: number;
  locked?: boolean;
  lockedBy?: string;
  language?: string;
}

export interface FileTreeOptions {
  showHidden: boolean;
  showLocks: boolean;
  autoExpand: boolean;
  maxHeight: string;
}

export const FileTree = {
  // File icons by extension
  fileIcons: {
    'ts': '📝',
    'tsx': '📝',
    'js': '📜',
    'jsx': '📜',
    'html': '🌐',
    'css': '🎨',
    'scss': '🎨',
    'sass': '🎨',
    'sql': '🗄️',
    'json': '📋',
    'yaml': '📄',
    'yml': '📄',
    'xml': '📄',
    'md': '📖',
    'txt': '📄',
    'py': '🐍',
    'go': '🐹',
    'rs': '🦀',
    'java': '☕',
    'cpp': '⚡',
    'c': '🔧',
    'h': '🔧',
    'hpp': '⚡',
    'php': '🐘',
    'rb': '💎',
    'swift': '🦉',
    'kt': '🟣',
    'dart': '🎯',
    'vue': '💚',
    'svelte': '🔥',
    'dockerfile': '🐳',
    'gitignore': '🐙',
    'env': '🔑',
    'lock': '🔒',
    'test': '🧪',
    'spec': '🔬',
    'config': '⚙️',
    'package': '📦',
    'readme': '📚',
    'license': '📜',
    'changelog': '📝',
    'contributing': '🤝',
    'default': '📄'
  },

  // Default options
  defaultOptions: {
    showHidden: false,
    showLocks: true,
    autoExpand: false,
    maxHeight: '400px'
  } as FileTreeOptions,

  render: (rootNodes: FileTreeNode[], options: FileTreeOptions = FileTree.defaultOptions) => {
    return html`
      <div class="file-tree-container" style="max-height: ${options.maxHeight};">
        <!-- Search Bar -->
        <div class="search-bar">
          <input type="text"
                 id="file-search"
                 placeholder="Search files..."
                 onkeyup="searchFiles(this.value)"
                 class="search-input" />
          <span class="search-icon">🔍</span>
        </div>

        <!-- Tree Header -->
        <div class="tree-header">
          <div class="tree-actions">
            <button class="tree-btn" onclick="expandAll()" title="Expand All">
              ▼
            </button>
            <button class="tree-btn" onclick="collapseAll()" title="Collapse All">
              ▶
            </button>
            <button class="tree-btn" onclick="createFile()" title="Create File">
              📄
            </button>
            <button class="tree-btn" onclick="createFolder()" title="Create Folder">
              📁
            </button>
          </div>
          <div class="tree-info">
            <span id="file-count">${FileTree.countFiles(rootNodes)} files</span>
            <span id="lock-indicator" style="display: ${options.showLocks ? 'inline' : 'none'};">
              🔒 <span id="locked-count">0</span> locked
            </span>
          </div>
        </div>

        <!-- Tree Content -->
        <div class="tree-content">
          ${rootNodes.map(node => FileTree.renderNode(node, 0, options)).join('')}
        </div>

        <!-- Context Menu (hidden by default) -->
        <div id="context-menu" class="context-menu" style="display: none;">
          <div class="menu-item" onclick="renameFile()">📝 Rename</div>
          <div class="menu-item" onclick="editFile()">✏️ Edit</div>
          <div class="menu-item" onclick="duplicateFile()">📋 Duplicate</div>
          <div class="menu-divider"></div>
          <div class="menu-item" onclick="downloadFile()">⬇️ Download</div>
          <div class="menu-item" onclick="copyPath()">📋 Copy Path</div>
          <div class="menu-divider"></div>
          <div class="menu-item" onclick="deleteFile()">🗑️ Delete</div>
        </div>

        <!-- File Creation Modal -->
        <div id="create-modal" class="modal" style="display: none;">
          <div class="modal-content">
            <span class="close" onclick="closeCreateModal()">&times;</span>
            <h2 id="modal-title">Create File</h2>
            <div class="form-group">
              <label for="create-name">Name:</label>
              <input type="text" id="create-name" placeholder="index.ts" />
            </div>
            <div class="form-group" id="create-type-group" style="display: none;">
              <label for="create-type">
                <input type="radio" id="create-file" name="create-type" value="file" checked />
                File
              </label>
              <label for="create-folder">
                <input type="radio" id="create-folder" name="create-type" value="folder" />
                Folder
              </label>
            </div>
            <div class="form-group" id="create-content-group" style="display: none;">
              <label for="create-content">Content (optional):</label>
              <textarea id="create-content" rows="4" placeholder="// Your code here..."></textarea>
            </div>
            <div class="modal-actions">
              <button class="btn btn-primary" onclick="confirmCreate()">Create</button>
              <button class="btn btn-secondary" onclick="closeCreateModal()">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Ad Integration Areas -->
        ${options.showLocks ? `
          <div class="ad-banner">
            <div class="ad-content">
              <span class="ad-icon">🔒</span>
              <div class="ad-text">
                <div class="ad-title">File Locking</div>
                <div class="ad-description">Collaborate safely with real-time locking</div>
              </div>
            </div>
          </div>
        ` : ''}

        <style>
          .file-tree-container {
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          .search-bar {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
            background: white;
          }

          .search-input {
            width: 100%;
            padding: 8px 32px 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 12px;
            outline: none;
            transition: border-color 0.2s;
          }

          .search-input:focus {
            border-color: #3b82f6;
          }

          .search-icon {
            position: absolute;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
          }

          .tree-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f1f5f9;
            border-bottom: 1px solid #e2e8f0;
          }

          .tree-actions {
            display: flex;
            gap: 4px;
          }

          .tree-btn {
            width: 28px;
            height: 28px;
            border: 1px solid #e2e8f0;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            transition: all 0.2s;
          }

          .tree-btn:hover {
            background: #f8fafc;
            border-color: #94a3b8;
          }

          .tree-info {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 12px;
            color: #64748b;
          }

          .tree-content {
            overflow-y: auto;
            max-height: calc(100% - 70px);
          }

          .tree-content::-webkit-scrollbar {
            width: 6px;
          }

          .tree-content::-webkit-scrollbar-track {
            background: #f1f5f9;
          }

          .tree-content::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 3px;
          }

          .tree-content::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }

          .tree-node {
            user-select: none;
            transition: background-color 0.2s;
          }

          .tree-node:hover {
            background: #f8fafc;
          }

          .tree-node.selected {
            background: #e0f2fe;
          }

          .tree-content {
            padding: 4px;
          }

          .tree-node-content {
            display: flex;
            align-items: center;
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 4px;
            position: relative;
          }

          .tree-node-content.locked {
            background: rgba(239, 68, 68, 0.1);
          }

          .tree-node-content.locked:hover {
            background: rgba(239, 68, 68, 0.2);
          }

          .tree-toggle {
            width: 16px;
            height: 16px;
            border: none;
            background: transparent;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #94a3b8;
            margin-right: 4px;
            transition: transform 0.2s;
        }

          .tree-toggle.expanded {
            transform: rotate(90deg);
        }

          .tree-node-content:hover .tree-toggle {
            color: #334155;
          }

          .tree-icon {
            margin-right: 8px;
            font-size: 14px;
            width: 16px;
            text-align: center;
        }

          .tree-name {
            flex: 1;
            font-size: 13px;
            color: #334155;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .tree-name.hidden {
            color: #94a3b8;
          }

          .tree-size {
            font-size: 11px;
            color: #94a3b8;
            margin-left: 8px;
          }

          .tree-locked {
            width: 14px;
            height: 14px;
            margin-left: 6px;
            color: #ef4444;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
          }

          .tree-locked.locked-by {
            margin-left: 2px;
            font-size: 9px;
            color: #dc2626;
            font-weight: 500;
          }

          .tree-children {
            margin-left: 20px;
            border-left: 1px solid #e2e8f0;
            margin-left: 12px;
            padding-left: 8px;
          }

          .tree-children.collapsed {
            display: none;
          }

          .context-menu {
            position: fixed;
            top: 0;
            left: 0;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            min-width: 160px;
            padding: 4px;
            display: none;
          }

          .context-menu.show {
            display: block;
          }

          .menu-item {
            padding: 8px 12px;
            font-size: 13px;
            color: #334155;
            cursor: pointer;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .menu-item:hover {
            background: #f1f5f9;
            color: #1e293b;
          }

          .menu-divider {
            height: 1px;
            background: #e2e8f0;
            margin: 4px 0;
          }

          .ad-banner {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px;
            margin: 8px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .ad-icon {
            font-size: 24px;
            flex-shrink: 0;
          }

          .ad-text {
            flex: 1;
        }

          .ad-title {
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 2px;
          }

          .ad-description {
            font-size: 12px;
            opacity: 0.9;
          }

          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1001;
          }

          .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            width: 400px;
            max-width: 90vw;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          }

          .modal-content h2 {
            margin: 0 0 16px 0;
            color: #1e293b;
          }

          .form-group {
            margin-bottom: 16px;
          }

          .form-group label {
            display: block;
            color: #475569;
            font-size: 12px;
            margin-bottom: 6px;
          }

          .form-group input[type="text"],
          .form-group textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 12px;
            outline: none;
            transition: border-color 0.2s;
          }

          .form-group input[type="text"]:focus,
          .form-group textarea:focus {
            border-color: #3b82f6;
          }

          .form-group textarea {
            resize: vertical;
            min-height: 80px;
            font-family: monospace;
          }

          .form-group input[type="radio"] {
            margin-right: 6px;
          }

          .modal-actions {
            display: flex;
            gap: 8px;
            margin-top: 20px;
          }

          .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            flex: 1;
            transition: all 0.2s;
          }

          .btn-primary {
            background: #3b82f6;
            color: white;
          }

          .btn-primary:hover {
            background: #2563eb;
          }

          .btn-secondary {
            background: #f1f5f9;
            color: #64748b;
            border: 1px solid #e2e8f0;
          }

          .btn-secondary:hover {
            background: #e2e8f0;
            color: #475569;
          }

          .modal .close {
            position: absolute;
            top: 12px;
            right: 12px;
            font-size: 20px;
            cursor: pointer;
            color: #94a3b8;
            border: none;
            background: transparent;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          }

          .modal .close:hover {
            background: #f1f5f9;
            color: #334155;
          }

          @media (max-width: 768px) {
            .file-tree-container {
              border-radius: 0;
              margin: 0;
              width: 100%;
            }

            .tree-header {
              padding: 8px;
            }

            .tree-actions {
              gap: 2px;
            }

            .tree-btn {
              width: 24px;
              height: 24px;
              font-size: 10px;
            }

            .modal-content {
              width: 95vw;
            }
          }
        </style>

        <script>
          let treeData = ${JSON.stringify(rootNodes)};
          let selectedNode = null;
          let contextMenuTarget = null;
          let createType = 'file';
          let createParent = null;

          // Initialize the file tree
          function initializeFileTree() {
            renderTree();
            countLockedFiles();
          }

          function renderTree() {
            const container = document.querySelector('.tree-content');
            const treeHtml = treeData.map(node => FileTree.renderNode(node, 0)).join('');
            container.textContent = '';
            container.insertAdjacentHTML('beforeend', treeHtml);
            attachTreeEventListeners();
          }

          function attachTreeEventListeners() {
            // Node click handlers
            document.querySelectorAll('.tree-node-content').forEach(nodeElement => {
              nodeElement.addEventListener('click', (e) => {
                e.stopPropagation();
                const nodeId = nodeElement.dataset.nodeId;
                selectNode(nodeId);
              });

              nodeElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e, nodeElement);
              });
            });

            // Toggle handlers
            document.querySelectorAll('.tree-toggle').forEach(toggle => {
              toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleNode(toggle.dataset.nodeId);
              });
            });
          }

          function renderNode(node, level = 0, options = {}) {
            const hasChildren = node.children && node.children.length > 0;
            const isExpanded = node.expanded !== false && options.autoExpand !== false;
            const isLocked = node.locked;
            const lockedBy = node.lockedBy || '';
            const isHidden = node.name.startsWith('.');
            const isFolder = node.type === 'folder';

            // Skip hidden files if configured
            if (!options.showHidden && isHidden) {
              return '';
            }

            const icon = getIcon(node);
            const sizeText = node.size ? formatFileSize(node.size) : '';
            const indent = level * 16;

            const lockIndicator = options.showLocks ? (isLocked ? `
              <span className="tree-locked">🔒</span>
            ` : '') : '';

            const lockedByText = options.showLocks && lockedBy ? `
              <span class="tree-locked locked-by">${lockedBy}</span>
            ` : '';

            const toggle = hasChildren ? `
              <button class="tree-toggle ${isExpanded ? 'expanded' : ''}"
                      data-node-id="${escapeHtml(node.id)}"
                      onclick="toggleNode('${escapeHtml(node.id)}')">
                ▶
              </button>
            ` : '<span style="width: 20px; display: inline-block;"></span>';

            const nodeClass = [
              'tree-node',
              isHidden ? 'hidden' : '',
              isLocked ? 'locked' : '',
              selectedNode?.id === node.id ? 'selected' : ''
            ].join(' ');

            return `
              <div class="tree-node" data-level="${level}">
                <div class="tree-node-content ${isLocked ? 'locked' : ''}"
                     data-node-id="${escapeHtml(node.id)}"
                     style="padding-left: ${indent + 8}px;">
                  ${toggle}
                  <span class="tree-icon">${icon}</span>
                  <span class="tree-name">${escapeHtml(node.name)}</span>
                  ${sizeText ? `<span class="tree-size">${escapeHtml(sizeText)}</span>` : ''}
                  ${lockIndicator}
                  ${lockedByText}
                </div>
                ${hasChildren && isExpanded ? `
                  <div class="tree-children">
                    ${node.children.map(child => renderNode(child, level + 1, options)).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }

          function getIcon(node) {
            if (node.type === 'folder') {
              return node.expanded !== false ? '📁' : '📂';
            }

            const extension = node.name.split('.').pop().toLowerCase();
            return FileTree.fileIcons[extension] || FileTree.fileIcons['default'];
          }

          function toggleNode(nodeId) {
            const node = findNode(treeData, nodeId);
            if (node) {
              node.expanded = !node.expanded;
              renderTree();
            }
          }

          function expandAll() {
            function expand(nodes) {
              nodes.forEach(node => {
                if (node.children) {
                  node.expanded = true;
                  expand(node.children);
                }
              });
            }
            expand(treeData);
            renderTree();
          }

          function collapseAll() {
            function collapse(nodes) {
              nodes.forEach(node => {
                node.expanded = false;
                if (node.children) {
                  collapse(node.children);
                }
              });
            }
            collapse(treeData);
            renderTree();
          }

          function selectNode(nodeId) {
            // Remove previous selection
            document.querySelectorAll('.tree-node-content').forEach(el => {
              el.classList.remove('selected');
            });

            // Add selection to new node
            const element = document.querySelector(\`.tree-node-content[data-node-id="\${escapeHtml(nodeId)}"]\`);
            if (element) {
              element.classList.add('selected');
            }

            // Update selected node data
            selectedNode = findNode(treeData, nodeId);
            if (selectedNode) {
              // Dispatch event for file selection
              window.dispatchEvent(new CustomEvent('file-selected', {
                detail: { node: selectedNode }
              }));
            }
          }

          function showContextMenu(event, nodeElement) {
            contextMenuTarget = nodeElement;
            const menu = document.getElementById('context-menu');

            menu.style.display = 'block';
            menu.style.left = event.pageX + 'px';
            menu.style.top = event.pageY + 'px';

            // Hide menu if clicked outside
            setTimeout(() => {
              document.addEventListener('click', hideContextMenu);
            }, 0);
          }

          function hideContextMenu() {
            document.getElementById('context-menu').style.display = 'none';
            document.removeEventListener('click', hideContextMenu);
          }

          function createFile() {
            document.getElementById('modal-title').textContent = 'Create File';
            document.getElementById('create-type-group').style.display = 'block';
            document.getElementById('create-content-group').style.display = 'block';
            document.getElementById('create-file').checked = true;
            document.getElementById('create-folder').checked = false;
            createType = 'file';
            createParent = selectedNode;
            document.getElementById('create-modal').style.display = 'block';
          }

          function createFolder() {
            document.getElementById('modal-title').textContent = 'Create Folder';
            document.getElementById('create-type-group').style.display = 'block';
            document.getElementById('create-content-group').style.display = 'none';
            document.getElementById('create-file').checked = false;
            document.getElementById('create-folder').checked = true;
            createType = 'folder';
            createParent = selectedNode;
            document.getElementById('create-modal').style.display = 'block';
          }

          function confirmCreate() {
            const name = document.getElementById('create-name').value.trim();
            if (!name) {
              alert('Please enter a name.');
              return;
            }

            // Create new node
            const newNode = {
              id: 'node-' + Date.now(),
              name: name,
              path: createParent ? createParent.path + '/' + name : name,
              type: createType,
              locked: false,
              modified: Date.now()
            };

            if (createType === 'folder') {
              newNode.children = [];
            } else if (createType === 'file') {
              newNode.content = document.getElementById('create-content').value;
              const extension = name.split('.').pop();
              newNode.language = extension;
            }

            // Add to parent or root
            if (createParent) {
              if (!createParent.children) {
                createParent.children = [];
              }
              createParent.children.push(newNode);
            } else {
              treeData.push(newNode);
            }

            // Close modal and refresh tree
            closeCreateModal();
            renderTree();
            countFiles();
            countLockedFiles();
          }

          function closeCreateModal() {
            document.getElementById('create-modal').style.display = 'none';
            document.getElementById('create-name').value = '';
            document.getElementById('create-content').value = '';
          }

          function renameFile() {
            if (!selectedNode) return;

            const newName = prompt('Enter new name:', selectedNode.name);
            if (newName && newName.trim()) {
              selectedNode.name = newName.trim();
              renderTree();
              hideContextMenu();
            }
          }

          function editFile() {
            if (!selectedNode) return;

            // Dispatch edit event
            window.dispatchEvent(new CustomEvent('file-edit', {
              detail: { node: selectedNode }
            }));
            hideContextMenu();
          }

          function duplicateFile() {
            if (!selectedNode) return;

            const newNode = {
              ...selectedNode,
              id: 'node-' + Date.now(),
              name: selectedNode.name + '-copy'
            };

            if (selectedNode.children) {
              newNode.children = [...selectedNode.children];
            }

            if (selectedNode.children) {
              if (!selectedNode.children) {
                selectedNode.children = [];
              }
              selectedNode.children.push(newNode);
            } else {
              const parent = findParent(treeData, selectedNode.id);
              if (parent) {
                if (!parent.children) {
                  parent.children = [];
                }
                parent.children.push(newNode);
              } else {
                treeData.push(newNode);
              }
            }

            renderTree();
            countFiles();
            hideContextMenu();
          }

          function downloadFile() {
            if (!selectedNode || selectedNode.type !== 'file') return;

            // Create download link
            const content = selectedNode.content || '';
            const blob = new Blob([content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = selectedNode.name;
            a.click();
            window.URL.revokeObjectURL(url);
            hideContextMenu();
          }

          function copyPath() {
            if (!selectedNode) return;

            navigator.clipboard.writeText(selectedNode.path).then(() => {
              alert('Path copied to clipboard!');
            }).catch(() => {
              alert('Failed to copy path.');
            });
            hideContextMenu();
          }

          function deleteFile() {
            if (!selectedNode) return;

            if (confirm(\`Are you sure you want to delete "\${escapeHtml(selectedNode.name)}"?`)) {
              deleteNode(treeData, selectedNode.id);
              selectedNode = null;
              renderTree();
              countFiles();
              countLockedFiles();
            }
            hideContextMenu();
          }

          function searchFiles(query) {
            if (!query) {
              // Clear highlighting
              document.querySelectorAll('.tree-node-content').forEach(el => {
                el.classList.remove('highlighted');
              });
              return;
            }

            // Search and highlight
            function searchInNodes(nodes) {
              nodes.forEach(node => {
                const element = document.querySelector(\`.tree-node-content[data-node-id="\${escapeHtml(node.id)}"]\`);
                if (node.name.toLowerCase().includes(query.toLowerCase())) {
                  if (element) element.style.backgroundColor = '#fef3c7';
                } else {
                  if (element) element.style.backgroundColor = '';
                }

                if (node.children) {
                  searchInNodes(node.children);
                }
              });
            }

            searchInNodes(treeData);
          }

          function findNode(nodes, nodeId) {
            for (const node of nodes) {
              if (node.id === nodeId) return node;
              if (node.children) {
                const found = findNode(node.children, nodeId);
                if (found) return found;
              }
            }
            return null;
          }

          function findParent(nodes, nodeId, parent = null) {
            for (const node of nodes) {
              if (node.id === nodeId) return parent;
              if (node.children) {
                const found = findParent(node.children, nodeId, node);
                if (found) return found;
              }
            }
            return null;
          }

          function deleteNode(nodes, nodeId) {
            const index = nodes.findIndex(n => n.id === nodeId);
            if (index > -1) {
              nodes.splice(index, 1);
              return true;
            }

            for (const node of nodes) {
              if (node.children && deleteNode(node.children, nodeId)) {
                return true;
              }
            }
            return false;
          }

          function formatFileSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
          }

          function countFiles() {
            let count = 0;

            function countInNodes(nodes) {
              nodes.forEach(node => {
                if (node.type === 'file') {
                  count++;
                }
                if (node.children) {
                  countInNodes(node.children);
                }
              });
            }

            countInNodes(treeData);
            const fileCountElement = document.getElementById('file-count');
            if (fileCountElement) {
              fileCountElement.textContent = count + ' files';
            }
          }

          function countLockedFiles() {
            let count = 0;

            function countInNodes(nodes) {
              nodes.forEach(node => {
                if (node.locked) {
                  count++;
                }
                if (node.children) {
                  countInNodes(node.children);
                }
              });
            }

            countInNodes(treeData);
            const lockedCountElement = document.getElementById('locked-count');
            if (lockedCountElement) {
              lockedCountElement.textContent = count;
            }
          }

          function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          }

          // Event listeners
          document.addEventListener('DOMContentLoaded', () => {
            initializeFileTree();

            // Handle context menu type change
            document.querySelectorAll('input[name="create-type"]').forEach(radio => {
              radio.addEventListener('change', (e) => {
                createType = e.target.value;
                const modalTitle = document.getElementById('modal-title');
                if (modalTitle) {
                  modalTitle.textContent = createType === 'file' ? 'Create File' : 'Create Folder';
                }
                const contentGroup = document.getElementById('create-content-group');
                if (contentGroup) {
                  contentGroup.style.display = createType === 'file' ? 'block' : 'none';
                }
              });
            });

            // Handle escape key to close modals
            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                hideContextMenu();
                closeCreateModal();
              }
            });
          });

          // Expose functions to global scope
          window.FileTree = FileTree;
          window.renderTree = renderTree;
          window.selectNode = selectNode;
          window.toggleNode = toggleNode;
          window.expandAll = expandAll;
          window.collapseAll = collapseAll;
          window.createFile = createFile;
          window.createFolder = createFolder;
          window.closeCreateModal = closeCreateModal;
          window.confirmCreate = confirmCreate;
          window.renameFile = renameFile;
          window.editFile = editFile;
          window.duplicateFile = duplicateFile;
          window.downloadFile = downloadFile;
          window.copyPath = copyPath;
          window.deleteFile = deleteFile;
          window.searchFiles = searchFiles;
        </script>
      </div>
    `;
  },

  countFiles(nodes: FileTreeNode[]): number {
    let count = 0;

    function countInNodes(nodes: FileTreeNode[]) {
      nodes.forEach(node => {
        if (node.type === 'file') {
          count++;
        }
        if (node.children) {
          countInNodes(node.children);
        }
      });
    }

    countInNodes(nodes);
    return count;
  }
};