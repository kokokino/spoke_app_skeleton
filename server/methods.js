import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { check, Match } from 'meteor/check';
import { checkSubscription } from '../imports/hub/subscriptions.js';

// In-memory chat message store
const MAX_MESSAGES = 100;
const messages = [];
const subscribers = new Map();
let subscriberIdCounter = 0;

export const chatMessageStore = {
  getMessages() {
    return [...messages];
  },
  
  addMessage(message) {
    messages.push(message);
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }
    // Notify all subscribers
    subscribers.forEach(sub => {
      sub.added(message);
    });
  },
  
  addSubscriber(callbacks) {
    const id = ++subscriberIdCounter;
    subscribers.set(id, callbacks);
    return id;
  },
  
  removeSubscriber(id) {
    subscribers.delete(id);
  }
};

Meteor.methods({
  // Send a chat message
  async 'chat.send'(text) {
    check(text, String);
    
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in to send messages');
    }
    
    // Validate text
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      throw new Meteor.Error('invalid-message', 'Message cannot be empty');
    }
    if (trimmedText.length > 500) {
      throw new Meteor.Error('invalid-message', 'Message too long (max 500 characters)');
    }
    
    // Get user info
    const user = await Meteor.users.findOneAsync(this.userId);
    if (!user) {
      throw new Meteor.Error('not-authorized', 'User not found');
    }
    
    // Check subscription (optional - can be enabled if chat requires subscription)
    const settings = Meteor.settings.public || {};
    const requiredProducts = settings.requiredProducts || [];
    
    if (requiredProducts.length > 0) {
      const hasAccess = await checkSubscription(this.userId, requiredProducts);
      if (!hasAccess) {
        throw new Meteor.Error('subscription-required', 'Active subscription required to send messages');
      }
    }
    
    const message = {
      _id: Random.id(),
      text: trimmedText,
      userId: this.userId,
      username: user.username || 'Anonymous',
      createdAt: new Date()
    };
    
    chatMessageStore.addMessage(message);
    
    return message._id;
  },
  
  // Get current user's subscription status
  async 'user.getSubscriptionStatus'() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }
    
    const user = await Meteor.users.findOneAsync(this.userId);
    if (!user) {
      throw new Meteor.Error('not-found', 'User not found');
    }
    
    return {
      subscriptions: user.profile?.subscriptions || [],
      hubUserId: user.services?.sso?.hubUserId
    };
  },
  
  // Check if user has required subscription
  async 'user.hasAccess'(requiredProductIds) {
    check(requiredProductIds, Match.Optional([String]));
    
    if (!this.userId) {
      return false;
    }
    
    const products = requiredProductIds || Meteor.settings.public?.requiredProducts || [];
    
    if (products.length === 0) {
      return true; // No subscription required
    }
    
    return await checkSubscription(this.userId, products);
  }
});
