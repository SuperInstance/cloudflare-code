#!/usr/bin/env node

// @ts-nocheck - External commander dependency
import { Command } from 'commander';
import { MessagingBroker } from '../broker';
import { readFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .name('messaging')
  .description('ClaudeFlare Messaging Broker CLI')
  .version('1.0.0');

program
  .command('start')
  .description('Start the messaging broker')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .action(async (options) => {
    try {
      let config: any = {};

      if (options.config) {
        try {
          const configPath = join(process.cwd(), options.config);
          config = JSON.parse(readFileSync(configPath, 'utf-8'));
        } catch (error) {
          console.error('Error reading configuration file:', error);
          process.exit(1);
        }
      }

      const broker = new MessagingBroker(config);
      await broker.start();

      console.log('Messaging broker started successfully');
      console.log(`Press Ctrl+C to stop`);

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\nShutting down gracefully...');
        await broker.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\nShutting down gracefully...');
        await broker.stop();
        process.exit(0);
      });

    } catch (error) {
      console.error('Failed to start messaging broker:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check messaging broker status')
  .action(async () => {
    try {
      const broker = new MessagingBroker();
      const isRunning = await broker.isHealthy();

      console.log('Messaging Broker Status:');
      console.log(`  Status: ${isRunning ? 'Running' : 'Stopped'}`);

      if (isRunning) {
        const stats = await broker.getStats();
        console.log(`  Topics: ${stats.totalTopics}`);
        console.log(`  Subscriptions: ${stats.totalSubscriptions}`);
        console.log(`  Total Messages: ${stats.totalMessages}`);
        console.log(`  Message Rate: ${stats.messageRate.toFixed(2)} messages/s`);
        console.log(`  Uptime: ${Math.floor(stats.uptime)} seconds`);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show detailed messaging broker statistics')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const broker = new MessagingBroker();
      const metrics = await broker.getMetrics();

      if (options.json) {
        console.log(JSON.stringify(metrics, null, 2));
      } else {
        console.log('Messaging Broker Statistics:');
        console.log('\nTopics:');
        console.log(`  Total Topics: ${metrics.topics.total}`);
        console.log(`  Total Messages: ${metrics.topics.messages}`);
        console.log(`  Total Size: ${metrics.topics.size} bytes`);

        console.log('\nSubscribers:');
        console.log(`  Total Subscriptions: ${metrics.subscribers.total}`);
        console.log(`  Healthy Subscribers: ${metrics.subscribers.healthy}`);
        console.log(`  Unhealthy Subscribers: ${metrics.subscribers.unhealthy}`);

        console.log('\nDelivery:');
        console.log(`  Total Deliveries: ${metrics.delivery.total}`);
        console.log(`  Successful Deliveries: ${metrics.delivery.successful}`);
        console.log(`  Failed Deliveries: ${metrics.delivery.failed}`);
        console.log(`  Throughput: ${metrics.delivery.throughput.toFixed(2)} messages/s`);

        console.log('\nSystem:');
        console.log(`  Uptime: ${Math.floor(metrics.system.uptime)} seconds`);
        console.log(`  Memory Usage: ${metrics.system.memoryUsage} bytes`);
      }
    } catch (error) {
      console.error('Error getting statistics:', error);
      process.exit(1);
    }
  });

program
  .command('publish')
  .description('Publish a message to a topic')
  .requiredOption('-t, --topic <topic>', 'Topic to publish to')
  .requiredOption('-m, --message <message>', 'Message payload (JSON)')
  .option('-j, --headers <headers>', 'Message headers (JSON)')
  .action(async (options) => {
    try {
      const broker = new MessagingBroker();
      await broker.start();

      let payload: any;
      try {
        payload = JSON.parse(options.message);
      } catch {
        payload = options.message;
      }

      let headers: any = {};
      if (options.headers) {
        try {
          headers = JSON.parse(options.headers);
        } catch {
          console.error('Invalid headers JSON');
          process.exit(1);
        }
      }

      const result = await broker.publish(options.topic, payload, headers);

      if (result.success) {
        console.log(`Message published successfully`);
        console.log(`  Message ID: ${result.messageId}`);
        if (result.error) {
          console.log(`  Warnings: ${result.error}`);
        }
      } else {
        console.error(`Failed to publish message: ${result.error}`);
        process.exit(1);
      }

      await broker.stop();
    } catch (error) {
      console.error('Error publishing message:', error);
      process.exit(1);
    }
  });

program
  .command('subscribe')
  .description('Subscribe to a topic')
  .requiredOption('-t, --topic <topic>', 'Topic to subscribe to')
  .requiredOption('-s, --subscriber <subscriber>', 'Subscriber identifier')
  .option('-d, --delivery <guarantee>', 'Delivery guarantee (at-most-once|at-least-once|exactly-once)', 'at-least-once')
  .option('-b, --batch-size <size>', 'Batch size', '1')
  .action(async (options) => {
    try {
      const broker = new MessagingBroker();
      await broker.start();

      const result = await broker.subscribe(options.topic, options.subscriber, {
        deliveryGuarantee: options.delivery as any,
        batchSize: parseInt(options.batchSize)
      });

      if (result.success) {
        console.log(`Subscription created successfully`);
        console.log(`  Subscription ID: ${result.subscriptionId}`);
      } else {
        console.error(`Failed to create subscription: ${result.error}`);
        process.exit(1);
      }

      await broker.stop();
    } catch (error) {
      console.error('Error creating subscription:', error);
      process.exit(1);
    }
  });

program
  .command('topic')
  .description('Manage topics')
  .argument('<action>', 'Action to perform (create|list|delete)')
  .argument('[name]', 'Topic name')
  .option('-p, --partitions <count>', 'Number of partitions', '1')
  .option('-r, --replication <factor>', 'Replication factor', '1')
  .action(async (action, name, options) => {
    try {
      const broker = new MessagingBroker();
      await broker.start();

      switch (action) {
        case 'create':
          if (!name) {
            console.error('Topic name is required for create action');
            process.exit(1);
          }

          const topic = await broker.createTopic(name, parseInt(options.partitions), parseInt(options.replication));
          console.log(`Topic created successfully`);
          console.log(`  Topic Name: ${topic.name}`);
          console.log(`  Partitions: ${topic.partitions}`);
          console.log(`  Replication Factor: ${topic.replicationFactor}`);
          break;

        case 'list':
          const topics = await broker.getTopics();
          console.log(`Topics (${topics.length}):`);
          topics.forEach(topic => {
            console.log(`  ${topic.name} (Partitions: ${topic.partitions})`);
          });
          break;

        case 'delete':
          if (!name) {
            console.error('Topic name is required for delete action');
            process.exit(1);
          }
          console.log('Delete functionality not implemented in this version');
          break;

        default:
          console.error(`Unknown action: ${action}`);
          process.exit(1);
      }

      await broker.stop();
    } catch (error) {
      console.error(`Error in topic command:`, error);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parse();
}

export { program };