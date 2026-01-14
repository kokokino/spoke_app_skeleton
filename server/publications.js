import { Meteor } from 'meteor/meteor';
import { chatMessageStore } from './methods.js';

// Publish chat messages using a custom publication
// Messages are stored in-memory on the server, not in MongoDB
Meteor.publish('chatMessages', function() {
  const sub = this;
  
  if (!this.userId) {
    sub.ready();
    return;
  }
  
  // Send existing messages
  const messages = chatMessageStore.getMessages();
  messages.forEach(msg => {
    sub.added('chatMessages', msg._id, msg);
  });
  
  // Register this subscription for live updates
  const subscriberId = chatMessageStore.addSubscriber({
    added(msg) {
      sub.added('chatMessages', msg._id, msg);
    }
  });
  
  sub.ready();
  
  sub.onStop(() => {
    chatMessageStore.removeSubscriber(subscriberId);
  });
});

// Publish current user's subscription data
Meteor.publish('userData', function() {
  if (!this.userId) {
    return this.ready();
  }
  
  return Meteor.users.find(
    { _id: this.userId },
    { 
      fields: { 
        username: 1,
        emails: 1,
        'profile.subscriptions': 1,
        'services.sso.hubUserId': 1
      } 
    }
  );
});
