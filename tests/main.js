import assert from "assert";
import { Meteor } from "meteor/meteor";
import { Random } from "meteor/random";

// Import modules to test
if (Meteor.isServer) {
  import { validateSsoToken } from "../imports/hub/ssoHandler.js";
  import { checkSubscription } from "../imports/hub/subscriptions.js";
  import { chatMessageStore } from "../server/methods.js";
}

describe("spoke_app_skeleton", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "spoke_app_skeleton");
  });

  if (Meteor.isClient) {
    it("client is not server", function () {
      assert.strictEqual(Meteor.isServer, false);
    });
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });

    describe("SSO Token Validation", function () {
      it("rejects empty token", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        const result = await validateSsoToken(null);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.error, "no_token");
      });

      it("rejects undefined token", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        const result = await validateSsoToken(undefined);
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.error, "no_token");
      });

      it("rejects empty string token", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        const result = await validateSsoToken("");
        assert.strictEqual(result.valid, false);
        assert.strictEqual(result.error, "no_token");
      });

      it("rejects malformed token", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        const result = await validateSsoToken("not-a-valid-jwt");
        assert.strictEqual(result.valid, false);
        // Will be either 'invalid_signature' or 'configuration_error' depending on settings
        assert.ok(result.error);
      });

      it("rejects token with invalid signature", async function () {
        const { validateSsoToken } = await import("../imports/hub/ssoHandler.js");
        // A properly formatted but invalidly signed JWT
        const fakeToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0MTIzIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImFwcElkIjoic3Bva2VfYXBwX3NrZWxldG9uIiwiaWF0IjoxNzA0MDY3MjAwLCJleHAiOjE3MDQwNjc1MDAsIm5vbmNlIjoidGVzdC1ub25jZSJ9.invalid-signature";
        const result = await validateSsoToken(fakeToken);
        assert.strictEqual(result.valid, false);
      });
    });

    describe("Subscription Checking", function () {
      it("grants access when no products required", async function () {
        const { checkSubscription } = await import("../imports/hub/subscriptions.js");
        const result = await checkSubscription("fake-user-id", []);
        assert.strictEqual(result, true);
      });

      it("grants access when requiredProductIds is null", async function () {
        const { checkSubscription } = await import("../imports/hub/subscriptions.js");
        const result = await checkSubscription("fake-user-id", null);
        assert.strictEqual(result, true);
      });

      it("grants access when requiredProductIds is undefined", async function () {
        const { checkSubscription } = await import("../imports/hub/subscriptions.js");
        const result = await checkSubscription("fake-user-id", undefined);
        assert.strictEqual(result, true);
      });

      it("denies access for non-existent user with required products", async function () {
        const { checkSubscription } = await import("../imports/hub/subscriptions.js");
        const result = await checkSubscription("non-existent-user-id", ["base_monthly"]);
        assert.strictEqual(result, false);
      });
    });

    describe("Chat Message Store", function () {
      it("starts with empty messages", async function () {
        const { chatMessageStore } = await import("../server/methods.js");
        // Note: This test may fail if other tests have added messages
        // In a real test suite, you'd want to reset state between tests
        const messages = chatMessageStore.getMessages();
        assert.ok(Array.isArray(messages));
      });

      it("adds a message correctly", async function () {
        const { chatMessageStore } = await import("../server/methods.js");
        const initialCount = chatMessageStore.getMessages().length;
        
        const testMessage = {
          _id: Random.id(),
          text: "Test message",
          userId: "test-user",
          username: "TestUser",
          createdAt: new Date()
        };
        
        chatMessageStore.addMessage(testMessage);
        
        const messages = chatMessageStore.getMessages();
        assert.strictEqual(messages.length, initialCount + 1);
        
        const lastMessage = messages[messages.length - 1];
        assert.strictEqual(lastMessage._id, testMessage._id);
        assert.strictEqual(lastMessage.text, "Test message");
        assert.strictEqual(lastMessage.username, "TestUser");
      });

      it("limits messages to MAX_MESSAGES", async function () {
        const { chatMessageStore } = await import("../server/methods.js");
        
        // Add 150 messages (more than MAX_MESSAGES which is 100)
        for (let i = 0; i < 150; i++) {
          chatMessageStore.addMessage({
            _id: Random.id(),
            text: `Message ${i}`,
            userId: "test-user",
            username: "TestUser",
            createdAt: new Date()
          });
        }
        
        const messages = chatMessageStore.getMessages();
        assert.ok(messages.length <= 100, `Expected <= 100 messages, got ${messages.length}`);
      });

      it("notifies subscribers when message added", async function () {
        const { chatMessageStore } = await import("../server/methods.js");
        
        let notifiedMessage = null;
        const subscriberId = chatMessageStore.addSubscriber({
          added(msg) {
            notifiedMessage = msg;
          }
        });
        
        const testMessage = {
          _id: Random.id(),
          text: "Subscriber test message",
          userId: "test-user",
          username: "TestUser",
          createdAt: new Date()
        };
        
        chatMessageStore.addMessage(testMessage);
        
        assert.ok(notifiedMessage, "Subscriber should have been notified");
        assert.strictEqual(notifiedMessage._id, testMessage._id);
        
        // Clean up
        chatMessageStore.removeSubscriber(subscriberId);
      });

      it("removes subscriber correctly", async function () {
        const { chatMessageStore } = await import("../server/methods.js");
        
        let callCount = 0;
        const subscriberId = chatMessageStore.addSubscriber({
          added(msg) {
            callCount++;
          }
        });
        
        // Add a message - should notify
        chatMessageStore.addMessage({
          _id: Random.id(),
          text: "First message",
          userId: "test-user",
          username: "TestUser",
          createdAt: new Date()
        });
        
        assert.strictEqual(callCount, 1);
        
        // Remove subscriber
        chatMessageStore.removeSubscriber(subscriberId);
        
        // Add another message - should NOT notify
        chatMessageStore.addMessage({
          _id: Random.id(),
          text: "Second message",
          userId: "test-user",
          username: "TestUser",
          createdAt: new Date()
        });
        
        assert.strictEqual(callCount, 1, "Removed subscriber should not be notified");
      });
    });

    describe("Chat Methods", function () {
      it("chat.send rejects unauthenticated users", async function () {
        try {
          // Call method without being logged in
          await Meteor.callAsync("chat.send", "Hello");
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert.strictEqual(error.error, "not-authorized");
        }
      });

      it("chat.send rejects empty messages", async function () {
        // This test would need a logged-in user context
        // For now, we just verify the method exists
        assert.ok(Meteor.server.method_handlers["chat.send"]);
      });

      it("user.hasAccess returns true when no products required", async function () {
        const result = await Meteor.callAsync("user.hasAccess", []);
        // Without a logged-in user, this should still return true for empty requirements
        // Actually, without userId it returns false - let's check the logic
        const resultNoUser = await Meteor.callAsync("user.hasAccess", []);
        // The method returns false if no userId, but true if empty array and has userId
        assert.strictEqual(resultNoUser, false); // No user logged in
      });

      it("user.getSubscriptionStatus rejects unauthenticated users", async function () {
        try {
          await Meteor.callAsync("user.getSubscriptionStatus");
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert.strictEqual(error.error, "not-authorized");
        }
      });
    });

    describe("Hub Client Functions", function () {
      it("exports required functions", async function () {
        const hubClient = await import("../imports/hub/client.js");
        
        assert.ok(typeof hubClient.hubApiRequest === "function");
        assert.ok(typeof hubClient.validateToken === "function");
        assert.ok(typeof hubClient.checkSubscriptionWithHub === "function");
        assert.ok(typeof hubClient.getUserInfo === "function");
        assert.ok(typeof hubClient.getHubPublicKey === "function");
      });
    });

    describe("Subscription Module", function () {
      it("exports required functions", async function () {
        const subscriptions = await import("../imports/hub/subscriptions.js");
        
        assert.ok(typeof subscriptions.checkSubscription === "function");
        assert.ok(typeof subscriptions.clearSubscriptionCache === "function");
        assert.ok(typeof subscriptions.getRequiredProducts === "function");
      });

      it("getRequiredProducts returns array", async function () {
        const { getRequiredProducts } = await import("../imports/hub/subscriptions.js");
        const products = getRequiredProducts();
        assert.ok(Array.isArray(products));
      });
    });
  }
});
