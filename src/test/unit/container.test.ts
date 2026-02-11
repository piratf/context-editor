/**
 * Unit tests for DI Container
 *
 * Tests the SimpleDIContainer implementation including:
 * - Singleton lifecycle
 * - Deferred registration (services can be registered in any order)
 * - Circular dependency detection
 * - Dependency injection
 * - Error handling
 * - Resource disposal
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SimpleDIContainer, ServiceToken, type Disposable } from "../../di/container.js";

void describe("SimpleDIContainer", () => {
  let container: SimpleDIContainer;

  beforeEach(() => {
    container = new SimpleDIContainer();
  });

  void describe("Singleton Lifecycle", () => {
    void it("should return the same instance for singleton services", () => {
      const token = new ServiceToken<string>("TestService");

      let callCount = 0;
      container.registerSingleton(token, () => {
        callCount++;
        return `instance-${String(callCount)}`;
      });

      // Not created before initialization
      assert.strictEqual(callCount, 0);

      // Initialize creates the instance
      container.initializeSingletons();
      assert.strictEqual(callCount, 1);

      const instance1 = container.get(token);
      const instance2 = container.get(token);

      assert.strictEqual(instance1, instance2);
      assert.strictEqual(instance1, "instance-1");
      assert.strictEqual(callCount, 1); // No new instance created
    });

    void it("should register multiple singleton services", () => {
      const token1 = new ServiceToken<number>("Service1");
      const token2 = new ServiceToken<string>("Service2");

      container.registerSingleton(token1, () => 42);
      container.registerSingleton(token2, () => "hello");

      container.initializeSingletons();

      assert.strictEqual(container.get(token1), 42);
      assert.strictEqual(container.get(token2), "hello");
    });
  });

  void describe("Deferred Registration", () => {
    void it("should allow registering services in any order", () => {
      const dependentToken = new ServiceToken<string>("Dependent");
      const dependencyToken = new ServiceToken<string>("Dependency");

      // Register dependent first
      container.registerSingleton(dependentToken, () => {
        return container.get(dependencyToken) + " depends on dependency";
      });

      // Register dependency second
      container.registerSingleton(dependencyToken, () => {
        return "dependency";
      });

      // Initialize all singletons
      container.initializeSingletons();

      // Verify correct dependency resolution
      assert.strictEqual(container.get(dependentToken), "dependency depends on dependency");
    });

    void it("should support chained dependencies with deferred registration", () => {
      const token1 = new ServiceToken<string>("Token1");
      const token2 = new ServiceToken<{ value1: string }>("Token2");
      const token3 = new ServiceToken<{ value1: string; value2: string }>("Token3");

      // Register in reverse order (token3 first, which depends on token2, which depends on token1)
      container.registerSingleton(token3, () => {
        const value2 = container.get(token2);
        return {
          value1: value2.value1,
          value2: "derived",
        };
      });

      container.registerSingleton(token2, () => ({
        value1: container.get(token1),
      }));

      container.registerSingleton(token1, () => "base");

      // Initialize all singletons
      container.initializeSingletons();

      const result = container.get(token3);
      assert.deepStrictEqual(result, { value1: "base", value2: "derived" });
    });
  });

  void describe("Circular Dependency Detection", () => {
    void it("should detect circular dependency during initialization", () => {
      const tokenA = new ServiceToken<string>("A");
      const tokenB = new ServiceToken<string>("B");

      container.registerSingleton(tokenA, () => {
        return container.get(tokenB); // A → B
      });

      container.registerSingleton(tokenB, () => {
        return container.get(tokenA); // B → A (circular!)
      });

      assert.throws(
        () => {
          container.initializeSingletons();
        },
        (error: Error) => error.message.includes("Circular dependency")
      );
    });

    void it("should detect circular dependency with three services", () => {
      const tokenA = new ServiceToken<string>("A");
      const tokenB = new ServiceToken<string>("B");
      const tokenC = new ServiceToken<string>("C");

      container.registerSingleton(tokenA, () => {
        return container.get(tokenB); // A → B
      });

      container.registerSingleton(tokenB, () => {
        return container.get(tokenC); // B → C
      });

      container.registerSingleton(tokenC, () => {
        return container.get(tokenA); // C → A (circular!)
      });

      assert.throws(
        () => {
          container.initializeSingletons();
        },
        (error: Error) => {
          const message = error.message;
          return message.includes("Circular dependency") &&
                 message.includes("A") &&
                 message.includes("B") &&
                 message.includes("C");
        }
      );
    });

    void it("should detect self-referencing dependency", () => {
      const tokenA = new ServiceToken<string>("A");

      container.registerSingleton(tokenA, () => {
        return container.get(tokenA); // A → A (self-reference)
      });

      assert.throws(
        () => {
          container.initializeSingletons();
        },
        (error: Error) => error.message.includes("Circular dependency")
      );
    });
  });

  void describe("Dependency Injection", () => {
    void it("should support injecting dependencies from container", () => {
      const dependencyToken = new ServiceToken<string>("Dependency");
      const serviceToken = new ServiceToken<{ getDependency: () => string }>("Service");

      container.registerSingleton(dependencyToken, () => "dependency-value");

      container.registerSingleton(serviceToken, () => {
        const dependency = container.get(dependencyToken);
        return {
          getDependency: () => dependency,
        };
      });

      container.initializeSingletons();

      const service = container.get(serviceToken);
      assert.strictEqual(service.getDependency(), "dependency-value");
    });

    void it("should support multiple dependencies", () => {
      const dep1Token = new ServiceToken<string>("Dep1");
      const dep2Token = new ServiceToken<number>("Dep2");
      const serviceToken = new ServiceToken<{ d1: string; d2: number }>("Service");

      container.registerSingleton(dep1Token, () => "value1");
      container.registerSingleton(dep2Token, () => 42);

      container.registerSingleton(serviceToken, () => {
        const d1 = container.get(dep1Token);
        const d2 = container.get(dep2Token);
        return { d1, d2 };
      });

      container.initializeSingletons();

      const service = container.get(serviceToken);
      assert.deepStrictEqual(service, { d1: "value1", d2: 42 });
    });
  });

  void describe("Error Handling", () => {
    void it("should throw error for unregistered service", () => {
      const unregisteredToken = new ServiceToken<number>("Unregistered");

      assert.throws(
        () => container.get(unregisteredToken),
        (error: Error) => error.message.includes("Service not registered: Unregistered")
      );
    });

    void it("should throw error with correct token description", () => {
      const token = new ServiceToken<unknown>("MyCustomService");

      assert.throws(
        () => container.get(token),
        (error: Error) => error.message.includes("MyCustomService")
      );
    });
  });

  void describe("Resource Disposal", () => {
    void it("should dispose disposable singletons", () => {
      const disposableToken = new ServiceToken<Disposable>("Disposable");

      let disposeCallCount = 0;
      const disposableInstance: Disposable = {
        dispose: () => {
          disposeCallCount++;
        },
      };

      container.registerSingleton(disposableToken, () => disposableInstance);
      container.initializeSingletons();
      container.get(disposableToken);

      container.dispose();

      assert.strictEqual(disposeCallCount, 1);
    });

    void it("should dispose all disposable singletons", () => {
      const token1 = new ServiceToken<Disposable>("Disposable1");
      const token2 = new ServiceToken<Disposable>("Disposable2");
      const token3 = new ServiceToken<number>("NonDisposable");

      let disposeCount1 = 0;
      let disposeCount2 = 0;

      container.registerSingleton(token1, () => ({
        dispose: () => {
          disposeCount1++;
        },
      }));

      container.registerSingleton(token2, () => ({
        dispose: () => {
          disposeCount2++;
        },
      }));

      container.registerSingleton(token3, () => 42);

      container.initializeSingletons();

      container.dispose();

      assert.strictEqual(disposeCount1, 1);
      assert.strictEqual(disposeCount2, 1);
    });

    void it("should not throw when disposing non-disposable instances", () => {
      const token = new ServiceToken<number>("NonDisposable");

      container.registerSingleton(token, () => 42);
      container.initializeSingletons();

      assert.doesNotThrow(() => {
        container.dispose();
      });
    });

    void it("should clear all services after disposal", () => {
      const singletonToken = new ServiceToken<string>("Singleton");

      container.registerSingleton(singletonToken, () => "test");
      container.initializeSingletons();

      container.dispose();

      assert.throws(() => container.get(singletonToken));
    });
  });

  void describe("Mock Injection", () => {
    void it("should allow mock injection for testing", () => {
      interface DataService {
        getData(): string;
      }

      const dataServiceToken = new ServiceToken<DataService>("DataService");

      const mockService: DataService = {
        getData: () => "mock-data",
      };

      container.registerSingleton(dataServiceToken, () => mockService);
      container.initializeSingletons();

      const service = container.get(dataServiceToken);
      assert.strictEqual(service.getData(), "mock-data");
      assert.strictEqual(service, mockService);
    });

    void it("should support replacing services with mocks", () => {
      interface Logger {
        log(message: string): void;
        messages: string[];
      }

      const loggerToken = new ServiceToken<Logger>("Logger");

      const testLogger: Logger = {
        log: (message: string) => {
          testLogger.messages.push(message);
        },
        messages: [],
      };

      container.registerSingleton(loggerToken, () => testLogger);
      container.initializeSingletons();

      const logger = container.get(loggerToken);
      logger.log("test message");

      assert.deepStrictEqual(logger.messages, ["test message"]);
    });
  });
});
