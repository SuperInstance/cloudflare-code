/**
 * Workflow Automation Example
 * Document approval workflow with guards and actions
 */

import { createStateMachine } from '../src/index.js';

interface DocumentContext {
  title: string;
  author: string;
  content: string;
  reviewers: string[];
  approvals: number;
  rejections: number;
  comments: string[];
}

const documentWorkflowDefinition = {
  initial: 'draft',
  context: {
    title: '',
    author: '',
    content: '',
    reviewers: [],
    approvals: 0,
    rejections: 0,
    comments: [],
  } as DocumentContext,
  states: {
    draft: {
      onEntry: ctx => console.log(`📝 Draft created: ${ctx.data?.title}`),
      transitions: [
        {
          from: 'draft',
          to: 'pending_review',
          on: 'SUBMIT',
          guard: ctx => {
            const hasContent = !!(ctx.data?.content && ctx.data.content.length > 0);
            const hasTitle = !!(ctx.data?.title && ctx.data.title.length > 0);
            return hasContent && hasTitle;
          },
          action: ctx => {
            console.log(`✅ Document submitted for review`);
          },
        },
      ],
    },
    pending_review: {
      onEntry: ctx => {
        console.log(`👀 Document under review by ${ctx.data?.reviewers.length} reviewers`);
      },
      transitions: [
        {
          from: 'pending_review',
          to: 'approved',
          on: 'APPROVE',
          guard: ctx => {
            const requiredApprovals = 2;
            return (ctx.data!.approvals + 1) >= requiredApprovals;
          },
          action: ctx => {
            ctx.data!.approvals++;
            console.log(`✅ Approval #${ctx.data!.approvals} received`);
          },
        },
        {
          from: 'pending_review',
          to: 'rejected',
          on: 'REJECT',
          action: ctx => {
            ctx.data!.rejections++;
            console.log(`❌ Document rejected`);
          },
        },
        {
          from: 'pending_review',
          to: 'revision_requested',
          on: 'REQUEST_CHANGES',
          action: ctx => {
            console.log(`📝 Changes requested`);
          },
        },
      ],
    },
    approved: {
      final: true,
      onEntry: ctx => {
        console.log(`🎉 Document approved! Ready for publication.`);
      },
      transitions: [
        {
          from: 'approved',
          to: 'published',
          on: 'PUBLISH',
          action: ctx => {
            console.log(`📢 "${ctx.data?.title}" has been published!`);
          },
        },
      ],
    },
    published: {
      final: true,
      onEntry: ctx => {
        console.log(`✨ Document is now live`);
      },
    },
    rejected: {
      onEntry: ctx => {
        console.log(`❌ Document rejected. ${ctx.data?.rejections} rejections total.`);
      },
      transitions: [
        {
          from: 'rejected',
          to: 'draft',
          on: 'REVISE',
          action: ctx => {
            ctx.data!.rejections = 0;
            ctx.data!.approvals = 0;
            console.log(`📝 Document returned to draft for revisions`);
          },
        },
      ],
    },
    revision_requested: {
      onEntry: ctx => {
        console.log(`📝 Revision requested`);
      },
      transitions: [
        {
          from: 'revision_requested',
          to: 'pending_review',
          on: 'RESUBMIT',
          action: ctx => {
            console.log(`📤 Document resubmitted after revisions`);
          },
        },
        {
          from: 'revision_requested',
          to: 'draft',
          on: 'EDIT',
          action: ctx => {
            console.log(`✏️ Document returned to draft for editing`);
          },
        },
      ],
    },
  },
};

async function demonstrateWorkflow() {
  console.log('📄 Document Approval Workflow Demo\n');

  const workflow = createStateMachine(documentWorkflowDefinition, {
    enableMetrics: true,
  });

  // Set document context
  workflow.context = {
    title: 'State Machine Architecture',
    author: 'Claude',
    content: 'This document describes the state machine architecture...',
    reviewers: ['alice', 'bob', 'charlie'],
    approvals: 0,
    rejections: 0,
    comments: [],
  };

  console.log('Current state:', workflow.state);

  // Try to submit without content (should fail guard)
  workflow.context.content = '';
  console.log('\n❌ Attempting to submit empty document...');
  try {
    await workflow.send('SUBMIT');
  } catch (error) {
    console.log('Guard prevented submission (expected)');
  }

  // Add content and submit
  workflow.context.content = 'Full document content here...';
  console.log('\n✅ Submitting complete document...');
  await workflow.send('SUBMIT');
  console.log('Current state:', workflow.state);

  // First approval
  console.log('\n👤 Reviewer 1 approves...');
  await workflow.send('APPROVE');

  // Second approval (meets threshold)
  console.log('\n👤 Reviewer 2 approves...');
  await workflow.send('APPROVE');
  console.log('Current state:', workflow.state);

  // Publish
  console.log('\n📢 Publishing document...');
  await workflow.send('PUBLISH');

  // Show statistics
  console.log('\n📊 Workflow Statistics:');
  const metrics = workflow.getTransitionMetrics();
  console.log(`Total transitions: ${metrics.total}`);
  console.log(`Successful: ${metrics.successful}`);
  console.log(`Average duration: ${metrics.avgDuration.toFixed(2)}ms`);

  return workflow;
}

// Run the demonstration
demonstrateWorkflow()
  .then(() => console.log('\n✅ Workflow demo complete'))
  .catch(err => console.error('❌ Error:', err));
