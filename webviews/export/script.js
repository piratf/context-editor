(function () {
  const vscode = acquireVsCodeApi();

  const progressContainer = document.getElementById("progress-container");
  const progressStatus = document.getElementById("progress-status");
  const progressPercentage = document.getElementById("progress-percentage");
  const progressFill = document.getElementById("progress-fill");
  const progressCurrent = document.getElementById("progress-current");

  const exportBtn = document.getElementById("export-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const targetPathInput = document.getElementById("target-path");
  const exportToDirectoryCheckBox = document.getElementById("export-to-directory");

  function updateExportButtonState() {
    const anyChecked = exportToDirectoryCheckBox.checked;
    exportBtn.disabled = !anyChecked;
    // Enable/disable input based on checkbox state
    targetPathInput.disabled = !exportToDirectoryCheckBox.checked;
  }

  exportBtn.addEventListener("click", function () {
    vscode.postMessage({
      type: "export",
      data: {
        toDirectory: exportToDirectoryCheckBox.checked
          ? {
              targetPath: targetPathInput.value,
            }
          : undefined,
      },
    });
  });

  cancelBtn.addEventListener("click", function () {
    vscode.postMessage({ type: "close" });
  });

  // Update button and input state when checkbox changes
  exportToDirectoryCheckBox.addEventListener("change", updateExportButtonState);

  // Allow Enter key to trigger export
  targetPathInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && !exportBtn.disabled) {
      exportBtn.click();
    }
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "progress":
        updateProgress(message.data);
        break;
      case "exportComplete":
        handleExportComplete(message.data);
        break;
      case "exportError":
        handleExportError(message.data);
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

  // Initialize states
  updateExportButtonState();
})();
