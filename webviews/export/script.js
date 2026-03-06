(function () {
  const vscode = acquireVsCodeApi();

  // State
  let treeData = null;
  let selectedNodeIds = new Set();
  let expandedNodeIds = new Set();
  let isEmpty = false;

  // DOM elements
  const progressContainer = document.getElementById("progress-container");
  const progressStatus = document.getElementById("progress-status");
  const progressPercentage = document.getElementById("progress-percentage");
  const progressFill = document.getElementById("progress-fill");
  const progressCurrent = document.getElementById("progress-current");

  const exportBtn = document.getElementById("export-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const targetPathInput = document.getElementById("target-path");
  const exportToDirectoryCheckBox = document.getElementById("export-to-directory");
  const browseBtn = document.getElementById("browse-btn");
  const emptyState = document.getElementById("empty-state");
  const treeContainer = document.getElementById("tree-container");
  const expandAllBtn = document.getElementById("expand-all-btn");
  const collapseAllBtn = document.getElementById("collapse-all-btn");
  const selectedCountEl = document.getElementById("selected-count");
  const totalCountEl = document.getElementById("total-count");
  const exportCountEl = document.getElementById("export-count");

  // Initialize empty state
  function initEmptyState() {
    if (isEmpty) {
      emptyState.style.display = "block";
      treeContainer.style.display = "none";
      exportBtn.disabled = true;
      targetPathInput.disabled = true;
      exportToDirectoryCheckBox.disabled = true;
      browseBtn.disabled = true;
    } else {
      emptyState.style.display = "none";
      treeContainer.style.display = "block";
    }
  }

  // Update export button state
  function updateExportButtonState() {
    if (isEmpty) {
      exportBtn.disabled = true;
      return;
    }
    const anySelected = selectedNodeIds.size > 0;
    const exportToDir = exportToDirectoryCheckBox.checked;
    exportBtn.disabled = !anySelected || !exportToDir;
    targetPathInput.disabled = !exportToDir;
    browseBtn.disabled = !exportToDir;
  }

  // Render tree node recursively
  function renderTreeNode(node, depth = 0) {
    const isSelected = selectedNodeIds.has(node.id);
    const isExpanded = expandedNodeIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isLeaf = node.type === "file";

    // Create node element
    const nodeEl = document.createElement("div");
    nodeEl.className = "tree-node";
    nodeEl.dataset.nodeId = node.id;

    // Toggle icon
    const toggleEl = document.createElement("div");
    toggleEl.className = "tree-node-toggle";
    if (isLeaf) {
      toggleEl.classList.add("leaf");
    } else if (!isExpanded) {
      toggleEl.classList.add("collapsed");
    }
    toggleEl.innerHTML = '<span class="tree-node-toggle-icon">▼</span>';
    nodeEl.appendChild(toggleEl);

    // Checkbox
    const checkboxEl = document.createElement("input");
    checkboxEl.type = "checkbox";
    checkboxEl.className = "tree-node-checkbox";
    checkboxEl.checked = isSelected;
    checkboxEl.dataset.nodeId = node.id;
    nodeEl.appendChild(checkboxEl);

    // Icon
    const iconEl = document.createElement("span");
    iconEl.className = "tree-node-icon";
    iconEl.textContent = isLeaf ? "$(file)" : "$(folder)";
    nodeEl.appendChild(iconEl);

    // Label
    const labelEl = document.createElement("span");
    labelEl.className = "tree-node-label";
    if (node.isSafe) {
      labelEl.classList.add("safe-node");
    }
    labelEl.textContent = node.name;
    labelEl.title = node.path;
    nodeEl.appendChild(labelEl);

    // Event listeners
    toggleEl.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleNode(node.id);
    });

    checkboxEl.addEventListener("change", (e) => {
      e.stopPropagation();
      toggleSelection(node.id, e.target.checked);
    });

    labelEl.addEventListener("click", (e) => {
      e.stopPropagation();
      checkboxEl.checked = !checkboxEl.checked;
      toggleSelection(node.id, checkboxEl.checked);
    });

    treeContainer.appendChild(nodeEl);

    // Render children
    if (hasChildren) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "tree-node-children";
      if (isExpanded) {
        childrenContainer.classList.add("expanded");
      }
      childrenContainer.dataset.parentId = node.id;
      treeContainer.appendChild(childrenContainer);

      node.children.forEach((child) => {
        const childEl = renderTreeNode(child, depth + 1);
        childrenContainer.appendChild(childEl);
      });
    }

    return nodeEl;
  }

  // Render entire tree
  function renderTree() {
    treeContainer.innerHTML = "";
    if (treeData) {
      renderTreeNode(treeData);
      updateStats();
    }
  }

  // Toggle node expand/collapse
  function toggleNode(nodeId) {
    if (expandedNodeIds.has(nodeId)) {
      expandedNodeIds.delete(nodeId);
    } else {
      expandedNodeIds.add(nodeId);
    }

    // Update DOM
    const toggleEl = document.querySelector(`.tree-node[data-node-id="${nodeId}"] .tree-node-toggle`);
    const childrenEl = document.querySelector(`.tree-node-children[data-parent-id="${nodeId}"]`);

    if (toggleEl) {
      if (expandedNodeIds.has(nodeId)) {
        toggleEl.classList.remove("collapsed");
      } else {
        toggleEl.classList.add("collapsed");
      }
    }

    if (childrenEl) {
      if (expandedNodeIds.has(nodeId)) {
        childrenEl.classList.add("expanded");
      } else {
        childrenEl.classList.remove("expanded");
      }
    }

    // Save state
    saveState();
  }

  // Toggle selection with parent-child sync
  function toggleSelection(nodeId, selected) {
    if (selected) {
      selectedNodeIds.add(nodeId);
    } else {
      selectedNodeIds.delete(nodeId);
    }

    // Update children
    updateChildrenSelection(nodeId, selected);

    // Update parents
    updateParentSelection(nodeId);

    // Update DOM
    updateSelectionDOM();

    // Update stats
    updateStats();

    // Save state
    saveState();
  }

  // Update children selection
  function updateChildrenSelection(parentId, selected) {
    const childrenEl = document.querySelector(`.tree-node-children[data-parent-id="${parentId}"]`);
    if (!childrenEl) return;

    const childCheckboxes = childrenEl.querySelectorAll(".tree-node-checkbox");
    childCheckboxes.forEach((checkbox) => {
      const childId = checkbox.dataset.nodeId;
      if (selected) {
        selectedNodeIds.add(childId);
      } else {
        selectedNodeIds.delete(childId);
      }
      checkbox.checked = selected;

      // Recursively update grandchildren
      updateChildrenSelection(childId, selected);
    });
  }

  // Update parent selection state
  function updateParentSelection(childId) {
    const nodeEl = document.querySelector(`.tree-node[data-node-id="${childId}"]`);
    if (!nodeEl) return;

    const childrenEl = nodeEl.parentElement;
    if (!childrenEl || !childrenEl.dataset.parentId) return;

    const parentId = childrenEl.dataset.parentId;
    const parentChildrenEl = document.querySelector(`.tree-node-children[data-parent-id="${parentId}"]`);
    if (!parentChildrenEl) return;

    const siblingCheckboxes = parentChildrenEl.querySelectorAll(".tree-node-checkbox");
    let allChecked = true;
    let noneChecked = true;

    siblingCheckboxes.forEach((checkbox) => {
      if (selectedNodeIds.has(checkbox.dataset.nodeId)) {
        noneChecked = false;
      } else {
        allChecked = false;
      }
    });

    const parentCheckbox = document.querySelector(`.tree-node-checkbox[data-node-id="${parentId}"]`);
    if (parentCheckbox) {
      if (allChecked) {
        parentCheckbox.checked = true;
        parentCheckbox.indeterminate = false;
        selectedNodeIds.add(parentId);
      } else if (noneChecked) {
        parentCheckbox.checked = false;
        parentCheckbox.indeterminate = false;
        selectedNodeIds.delete(parentId);
      } else {
        parentCheckbox.checked = false;
        parentCheckbox.indeterminate = true;
        selectedNodeIds.delete(parentId);
      }

      // Recursively update parent
      updateParentSelection(parentId);
    }
  }

  // Update selection DOM
  function updateSelectionDOM() {
    const checkboxes = document.querySelectorAll(".tree-node-checkbox");
    checkboxes.forEach((checkbox) => {
      const nodeId = checkbox.dataset.nodeId;
      const isSelected = selectedNodeIds.has(nodeId);

      // Check indeterminate state
      const childrenEl = document.querySelector(`.tree-node-children[data-parent-id="${nodeId}"]`);
      if (childrenEl) {
        const childCheckboxes = childrenEl.querySelectorAll(".tree-node-checkbox");
        let allChecked = true;
        let noneChecked = true;

        childCheckboxes.forEach((cb) => {
          if (selectedNodeIds.has(cb.dataset.nodeId)) {
            noneChecked = false;
          } else {
            allChecked = false;
          }
        });

        if (allChecked) {
          checkbox.checked = true;
          checkbox.indeterminate = false;
        } else if (noneChecked) {
          checkbox.checked = false;
          checkbox.indeterminate = false;
        } else {
          checkbox.checked = false;
          checkbox.indeterminate = true;
        }
      } else {
        checkbox.checked = isSelected;
        checkbox.indeterminate = false;
      }
    });
  }

  // Update statistics
  function updateStats() {
    let totalCount = 0;
    let selectedCount = 0;

    function countNodes(node) {
      if (node.type === "file") {
        totalCount++;
        if (selectedNodeIds.has(node.id)) {
          selectedCount++;
        }
      }
      if (node.children) {
        node.children.forEach(countNodes);
      }
    }

    if (treeData) {
      countNodes(treeData);
    }

    selectedCountEl.textContent = String(selectedCount);
    totalCountEl.textContent = String(totalCount);
    exportCountEl.textContent = String(selectedCount);
    updateExportButtonState();
  }

  // Save state to VS Code API
  function saveState() {
    vscode.setState({
      selectedNodeIds: Array.from(selectedNodeIds),
      expandedNodeIds: Array.from(expandedNodeIds),
    });
    vscode.postMessage({
      type: "stateChanged",
      data: {
        selectedNodeIds: Array.from(selectedNodeIds),
        expandedNodeIds: Array.from(expandedNodeIds),
      },
    });
  }

  // Expand all nodes
  function expandAll() {
    function expandNode(node) {
      if (node.children && node.children.length > 0) {
        expandedNodeIds.add(node.id);
        node.children.forEach(expandNode);
      }
    }

    if (treeData) {
      expandNode(treeData);
      updateDOMForExpanded();
      saveState();
    }
  }

  // Collapse all nodes
  function collapseAll() {
    expandedNodeIds.clear();
    updateDOMForExpanded();
    saveState();
  }

  // Update DOM for expanded state
  function updateDOMForExpanded() {
    const toggleEls = document.querySelectorAll(".tree-node-toggle");
    toggleEls.forEach((toggleEl) => {
      const nodeEl = toggleEl.closest(".tree-node");
      const nodeId = nodeEl.dataset.nodeId;

      if (expandedNodeIds.has(nodeId)) {
        toggleEl.classList.remove("collapsed");
      } else {
        toggleEl.classList.add("collapsed");
      }
    });

    const childrenEls = document.querySelectorAll(".tree-node-children");
    childrenEls.forEach((childrenEl) => {
      const parentId = childrenEl.dataset.parentId;

      if (expandedNodeIds.has(parentId)) {
        childrenEl.classList.add("expanded");
      } else {
        childrenEl.classList.remove("expanded");
      }
    });
  }

  // Export button click
  exportBtn.addEventListener("click", function () {
    vscode.postMessage({
      type: "export",
      data: {
        toDirectory: exportToDirectoryCheckBox.checked
          ? {
              targetPath: targetPathInput.value,
            }
          : undefined,
        selectedNodeIds: Array.from(selectedNodeIds),
      },
    });
  });

  // Cancel button click
  cancelBtn.addEventListener("click", function () {
    vscode.postMessage({ type: "close" });
  });

  // Checkbox change
  exportToDirectoryCheckBox.addEventListener("change", updateExportButtonState);

  // Enter key to trigger export
  targetPathInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !exportBtn.disabled) {
      exportBtn.click();
    }
  });

  // Browse button
  browseBtn.addEventListener("click", function () {
    vscode.postMessage({
      type: "selectDirectory",
      data: { currentPath: targetPathInput.value },
    });
  });

  // Expand/Collapse all buttons
  expandAllBtn.addEventListener("click", expandAll);
  collapseAllBtn.addEventListener("click", collapseAll);

  // Handle messages from extension
  window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message.type) {
      case "init":
        treeData = message.data.tree;
        isEmpty = !treeData || treeData.type === "empty";

        // Restore state
        const savedState = vscode.getState();
        if (savedState) {
          selectedNodeIds = new Set(savedState.selectedNodeIds || []);
          expandedNodeIds = new Set(savedState.expandedNodeIds || []);
        } else if (message.data.selectedNodeIds) {
          selectedNodeIds = new Set(message.data.selectedNodeIds);
          expandedNodeIds = new Set(message.data.expandedNodeIds || []);
        }

        initEmptyState();
        renderTree();
        updateExportButtonState();
        break;

      case "progress":
        updateProgress(message.data);
        break;

      case "exportComplete":
        handleExportComplete(message.data);
        break;

      case "exportError":
        handleExportError(message.data);
        break;

      case "directorySelected":
        targetPathInput.value = message.data.path;
        break;
    }
  });

  function updateProgress(data) {
    progressContainer.style.display = "block";

    const percentage = Math.round((data.current / data.total) * 100);
    progressPercentage.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;
    progressCurrent.textContent = `Exporting: ${data.currentItem}`;

    if (data.status === "error") {
      progressFill.style.backgroundColor = "var(--vscode-errorForeground)";
    } else {
      progressFill.style.backgroundColor = "var(--vscode-button-background)";
    }
  }

  function handleExportComplete(data) {
    progressStatus.textContent =
      data.errors > 0 ? `Completed with ${data.errors} errors` : "Completed!";
    progressFill.style.backgroundColor =
      data.errors > 0 ? "var(--vscode-terminal-ansiYellow)" : "var(--vscode-terminal-ansiGreen)";
    setTimeout(() => {
      progressContainer.style.display = "none";
    }, 3000);
  }

  function handleExportError(data) {
    progressStatus.textContent = "Export Failed";
    progressFill.style.backgroundColor = "var(--vscode-errorForeground)";
    setTimeout(() => {
      progressContainer.style.display = "none";
    }, 3000);
  }

  // Initialize
  updateExportButtonState();
})();
