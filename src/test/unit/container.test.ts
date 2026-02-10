/**
 * Unit tests for DI Container
 *
 * Tests the SimpleDIContainer implementation including:
 * - Singleton lifecycle
 * - Transient lifecycle
 * - Dependency injection
 * - Error handling
 * - Resource disposal
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SimpleDIContainer, ServiceToken, type Disposable } from "../../di/container.js";

describe("SimpleDIContainer", () => {
  let container: SimpleDIContainer;

  beforeEach(() => {
    container = new SimpleDIContainer();
  });

  describe("Singleton Lifecycle", () => {
    it("should return the same instance for singleton services", () => {
      const token = new ServiceToken<string>("TestService");

      let callCount = 0;
      container.registerSingleton(token, () => {
        callCount++;
        return `instance-${String(callCount)}`;
      });

      const instance1 = container.get(token);
      const instance2 = container.get(token);

      assert.strictEqual(instance1, instance2);
      assert.strictEqual(instance1, "instance-1");
      assert.strictEqual(callCount, 1);
    });

    it("should register multiple singleton services", () => {
      const token1 = new ServiceToken<number>("Service1");
      const token2 = new ServiceToken<string>("Service2");

      container.registerSingleton(token1, () => 42);
      container.registerSingleton(token2, () => "hello");

      assert.strictEqual(container.get(token1), 42);
      assert.strictEqual(container.get(token2), "hello");
    });
  });

  describe("Transient Lifecycle", () => {
    it("should create new instance for each transient service request", () => {
      const token = new ServiceToken<number>("TransientService");

      let callCount = 0;
      container.registerTransient(token, () => {
        callCount++;
        return callCount;
      });

      const instance1 = container.get(token);
      const instance2 = container.get(token);
      const instance3 = container.get(token);

      assert.strictEqual(instance1, 1);
      assert.strictEqual(instance2, 2);
      assert.strictEqual(instance3, 3);
      assert.strictEqual(callCount, 3);
    });

    it("should register multiple transient services", () => {
      const token1 = new ServiceToken<number>("Transient1");
      const token2 = new ServiceToken<string>("Transient2");

      container.registerTransient(token1, () => Date.now());
      container.registerTransient(token2, () => Math.random().toString());

      const value1 = container.get(token1);
      const value2 = container.get(token2);

      assert.strictEqual(typeof value1, "number");
      assert.strictEqual(typeof value2, "string");
    });
  });

  describe("Dependency Injection", () => {
    it("should support injecting dependencies from container", () => {
      const dependencyToken = new ServiceToken<string>("Dependency");
      const serviceToken = new ServiceToken<{ getDependency: () => string }>("Service");

      container.registerSingleton(dependencyToken, () => "dependency-value");

      container.registerTransient(serviceToken, () => {
        const dependency = container.get(dependencyToken);
        return {
          getDependency: () => dependency,
        };
      });

      const service = container.get(serviceToken);
      assert.strictEqual(service.getDependency(), "dependency-value");
    });

    it("should support chained dependencies", () => {
      const token1 = new ServiceToken<string>("Token1");
      const token2 = new ServiceToken<{ value1: string }>("Token2");
      const token3 = new ServiceToken<{ value1: string; value2: string }>("Token3");

      container.registerSingleton(token1, () => "base");

      container.registerTransient(token2, () => ({
        value1: container.get(token1),
      }));

      container.registerTransient(token3, () => {
        const value2 = container.get(token2);
        return {
          value1: value2.value1,
          value2: "derived",
        };
      });

      const result = container.get(token3);
      assert.deepStrictEqual(result, { value1: "base", value2: "derived" });
    });
  });

  describe("Error Handling", () => {
    it("should throw error for unregistered service", () => {
      const unregisteredToken = new ServiceToken<number>("Unregistered");

      assert.throws(
        () => container.get(unregisteredToken),
        (error: Error) => error.message.includes("Service not registered: Unregistered")
      );
    });

    it("should throw error with correct token description", () => {
      const token = new ServiceToken<unknown>("MyCustomService");

      assert.throws(
        () => container.get(token),
        (error: Error) => error.message.includes("MyCustomService")
      );
    });
  });

  describe("Resource Disposal", () => {
    it("should dispose disposable singletons", () => {
      const disposableToken = new ServiceToken<Disposable>("Disposable");

      let disposeCallCount = 0;
      const disposableInstance: Disposable = {
        dispose: () => {
          disposeCallCount++;
        },
      };

      container.registerSingleton(disposableToken, () => disposableInstance);
      container.get(disposableToken);

      container.dispose();

      assert.strictEqual(disposeCallCount, 1);
    });

    it("should dispose all disposable singletons", () => {
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

      container.get(token1);
      container.get(token2);
      container.get(token3);

      container.dispose();

      assert.strictEqual(disposeCount1, 1);
      assert.strictEqual(disposeCount2, 1);
    });

    it("should not throw when disposing non-disposable instances", () => {
      const token = new ServiceToken<number>("NonDisposable");

      container.registerSingleton(token, () => 42);
      container.get(token);

      assert.doesNotThrow(() => {
        container.dispose();
      });
    });

    it("should clear all services after disposal", () => {
      const singletonToken = new ServiceToken<string>("Singleton");
      const transientToken = new ServiceToken<number>("Transient");

      container.registerSingleton(singletonToken, () => "test");
      container.registerTransient(transientToken, () => 42);

      container.dispose();

      assert.throws(() => container.get(singletonToken));
      assert.throws(() => container.get(transientToken));
    });
  });

  describe("Mock Injection", () => {
    it("should allow mock injection for testing", () => {
      interface DataService {
        getData(): string;
      }

      const dataServiceToken = new ServiceToken<DataService>("DataService");

      const mockService: DataService = {
        getData: () => "mock-data",
      };

      container.registerSingleton(dataServiceToken, () => mockService);

      const service = container.get(dataServiceToken);
      assert.strictEqual(service.getData(), "mock-data");
      assert.strictEqual(service, mockService);
    });

    it("should support replacing services with mocks", () => {
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

      const logger = container.get(loggerToken);
      logger.log("test message");

      assert.deepStrictEqual(logger.messages, ["test message"]);
    });
  });
});
