/**
 * Dependency Injection Container
 *
 * Manages service lifecycle and dependencies for the Context Editor extension.
 * Supports singleton (shared) and transient (per-request) service lifecycles.
 */

/**
 * Disposable interface for resource cleanup
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Dependency Injection Container interface
 *
 * Provides methods for registering and retrieving services with different lifecycles.
 */
export interface DIContainer extends Disposable {
  /**
   * Get or create a service instance
   * @param token - Service identifier
   * @returns The service instance
   * @throws Error if service is not registered
   */
  get<T>(token: ServiceToken<T>): T;

  /**
   * Register a singleton service (created once, shared across all requests)
   * @param token - Service identifier
   * @param factory - Factory function to create the instance
   */
  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void;

  /**
   * Register a transient service (new instance created for each request)
   * @param token - Service identifier
   * @param factory - Factory function to create instances
   */
  registerTransient<T>(token: ServiceToken<T>, factory: () => T): void;
}

/**
 * Service identifier token for type-safe dependency lookup
 *
 * Uses Symbol as the key to ensure uniqueness and prevent accidental collisions.
 */
export class ServiceToken<T> {
  constructor(public readonly description: string, _typeHint?: T) {}
}

/**
 * Simple dependency injection container implementation
 *
 * Manages singleton and transient service lifecycles.
 * Automatically disposes disposable singletons on cleanup.
 */
export class SimpleDIContainer implements DIContainer {
  private singletons = new Map<ServiceToken<unknown>, unknown>();
  private transientFactories = new Map<ServiceToken<unknown>, () => unknown>();

  get<T>(token: ServiceToken<T>): T {
    // Return singleton if registered
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    // Create transient instance
    const factory = this.transientFactories.get(token);
    if (factory) {
      return factory() as T;
    }

    throw new Error(`Service not registered: ${token.description}`);
  }

  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void {
    const instance = factory();
    this.singletons.set(token, instance);
  }

  registerTransient<T>(token: ServiceToken<T>, factory: () => T): void {
    this.transientFactories.set(token, factory);
  }

  dispose(): void {
    // Dispose all disposable singletons
    for (const [token, instance] of this.singletons) {
      if (this.isDisposable(instance)) {
        try {
          instance.dispose();
        } catch (error) {
          console.error(`Error disposing service ${token.description}:`, error);
        }
      }
    }
    this.singletons.clear();
    this.transientFactories.clear();
  }

  private isDisposable(obj: unknown): obj is Disposable {
    return typeof obj === "object" && obj !== null && "dispose" in obj;
  }
}
