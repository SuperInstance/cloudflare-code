// @ts-nocheck - Complex namespace and type exports
export * from './types';
export * from './utils';
export { MessageRouter } from './router/router';
export { TopicManager } from './topics/manager';
export { SubscriberManager } from './subscribers/manager';
export { DeliveryEngine } from './delivery/engine';
export { MessagingBroker } from './broker';
export { createMessage, createTopic, createSubscription } from './utils';

export interface BrokerConfig {
  router?: Partial<MessageRouter.Config>;
  topics?: Partial<TopicManager.Config>;
  subscribers?: Partial<SubscriberManager.Config>;
  delivery?: Partial<DeliveryEngine.Config>;
}

export async function createMessagingBroker(config: BrokerConfig = {}): Promise<MessagingBroker> {
  const broker = new MessagingBroker(config);
  await broker.initialize();
  return broker;
}

