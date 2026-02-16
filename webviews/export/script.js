(function () {
  const vscode = acquireVsCodeApi();
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

  // Initialize states
  updateExportButtonState();
})();
