/**
 * Dependency Injection Container
 *
 * Manages service lifecycle and dependencies for the Context Editor extension.
 * Supports singleton (shared) services with deferred registration and circular dependency detection.
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
 * Provides methods for registering and retrieving services.
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
   * Initialize all singleton services
   * Creates all singleton instances immediately, detecting circular dependencies
   * @throws Error if circular dependency is detected
   */
  initializeSingletons(): void;
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
 * Features:
 * - Singleton lifecycle (all services are singletons)
 * - Deferred registration (services can be registered in any order)
 * - Circular dependency detection
 * - Automatic disposal of disposable services
 */
export class SimpleDIContainer implements DIContainer {
  private singletons = new Map<ServiceToken<unknown>, unknown>();
  private singletonFactories = new Map<ServiceToken<unknown>, () => unknown>();
  private resolvingStack = new Set<ServiceToken<unknown>>();

  get<T>(token: ServiceToken<T>): T {
    // Return existing instance if already created
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    // Check for circular dependency
    if (this.resolvingStack.has(token)) {
      const cycle = Array.from(this.resolvingStack).map((t) => t.description);
      cycle.push(token.description);
      throw new Error(`Circular dependency detected: ${cycle.join(" → ")}`);
    }

    // Create from singleton factory
    const factory = this.singletonFactories.get(token);
    if (factory) {
      this.resolvingStack.add(token);
      try {
        const instance = factory();
        this.singletons.set(token, instance);
        return instance as T;
      } finally {
        this.resolvingStack.delete(token);
      }
    }

    throw new Error(`Service not registered: ${token.description}`);
  }

  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void {
    this.singletonFactories.set(token, factory);
  }

  /**
   * Initialize all singleton services
   * Creates all singleton instances immediately, detecting circular dependencies
   */
  initializeSingletons(): void {
    for (const [token] of this.singletonFactories) {
      this.get(token); // Triggers creation, will throw on circular dependency
    }
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
    this.singletonFactories.clear();
  }

  private isDisposable(obj: unknown): obj is Disposable {
    return typeof obj === "object" && obj !== null && "dispose" in obj;
  }
}
