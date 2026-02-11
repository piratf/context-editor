/**
 * Progress Reporting Adapter
 *
 * Provides interface-based access to VS Code progress reporting.
 * Enables testing with mock implementations.
 */

/**
 * Progress reporting interface
 */
export interface Progress {
  /**
   * Report progress
   *
   * @param message - Progress message
   * @param increment - Optional increment value
   */
  report(message: string, increment?: number): void;
}

/**
 * Progress service interface
 */
export interface ProgressService {
  /**
   * Show progress with a callback
   *
   * @param title - Progress title
   * @param locationOrCallback - Progress location or callback function
   * @param callback - Optional callback function when location is provided
   * @returns Result from callback
   */
  showProgress<T>(
    title: string,
    locationOrCallback: ProgressLocation | ((progress: Progress) => Promise<T>),
    callback?: (progress: Progress) => Promise<T>
  ): Promise<T>;
}

/**
 * Progress location options
 */
export enum ProgressLocation {
  /** Window progress */
  Window = 1,
  /** Status bar progress */
  StatusBar = 15,
  /** Notification progress */
  Notification = 10,
}

/**
 * VS Code progress implementation
 */
export class VsCodeProgress implements Progress {
  constructor(private readonly progress: { report(value: { message?: string }): void }) {}

  report(message: string, _increment?: number): void {
    this.progress.report({ message });
  }
}

/**
 * VS Code progress service implementation
 */
export class VsCodeProgressService implements ProgressService {
  async showProgress<T>(
    title: string,
    locationOrCallback: ProgressLocation | ((progress: Progress) => Promise<T>),
    callback?: (progress: Progress) => Promise<T>
  ): Promise<T> {
    const { window, ProgressLocation: vscodeProgressLocation } = await import("vscode");

    const location: ProgressLocation =
      typeof locationOrCallback === "number" ? locationOrCallback : ProgressLocation.Window;
    const actualCallback: (progress: Progress) => Promise<T> =
      callback ?? (locationOrCallback as (progress: Progress) => Promise<T>);

    return window.withProgress(
      {
        location: this.toVsCodeLocation(location, vscodeProgressLocation),
        title,
        cancellable: false,
      },
      (progress) => {
        const progressAdapter = new VsCodeProgress(progress);
        return actualCallback(progressAdapter);
      }
    );
  }

  private toVsCodeLocation(
    location: ProgressLocation,
    vscodeProgressLocation: { Window: number; Notification: number }
  ): number {
    switch (location) {
      case ProgressLocation.Window:
        return vscodeProgressLocation.Window;
      case ProgressLocation.Notification:
        return vscodeProgressLocation.Notification;
      case ProgressLocation.StatusBar:
        return vscodeProgressLocation.Window; // Fallback for StatusBar
      default:
        return vscodeProgressLocation.Window;
    }
  }
}

/**
 * Mock progress for testing
 */
export class MockProgress implements Progress {
  messages: string[] = [];
  increments: number[] = [];

  report(message: string, increment?: number): void {
    this.messages.push(message);
    if (increment !== undefined) {
      this.increments.push(increment);
    }
  }

  getLastMessage(): string | undefined {
    return this.messages[this.messages.length - 1];
  }

  reset(): void {
    this.messages = [];
    this.increments = [];
  }
}

/**
 * Mock progress service for testing
 */
export class MockProgressService implements ProgressService {
  lastTitle: string | undefined;
  lastCallbackCalls = 0;

  async showProgress<T>(
    title: string,

    _locationOrCallback: ProgressLocation | ((progress: Progress) => Promise<T>),
    callback?: (progress: Progress) => Promise<T>
  ): Promise<T> {
    this.lastTitle = title;
    this.lastCallbackCalls++;

    const actualCallback: (progress: Progress) => Promise<T> =
      callback ?? (_locationOrCallback as (progress: Progress) => Promise<T>);

    const mockProgress = new MockProgress();
    return actualCallback(mockProgress);
  }

  reset(): void {
    this.lastTitle = undefined;
    this.lastCallbackCalls = 0;
  }
}
