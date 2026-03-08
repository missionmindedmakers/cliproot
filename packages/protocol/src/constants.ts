import type { SppBundle } from './types.js';

export type BundleType = SppBundle['bundleType'];
export type SourceType = NonNullable<SppBundle['sources']>[number]['sourceType'];
export type AgentType = NonNullable<SppBundle['agents']>[number]['agentType'];
export type ActivityType = NonNullable<SppBundle['activities']>[number]['activityType'];

export const BUNDLE_TYPES: readonly BundleType[] = ['document', 'clipboard', 'reuse-event'];
export const SOURCE_TYPES: readonly SourceType[] = [
  'human-authored',
  'ai-generated',
  'ai-assisted',
  'external-quoted',
  'unknown',
];
export const AGENT_TYPES: readonly AgentType[] = [
  'person',
  'organization',
  'model',
  'service',
  'system',
];
export const ACTIVITY_TYPES: readonly ActivityType[] = [
  'create',
  'paste',
  'import',
  'edit',
  'ai_generate',
  'reuse_detected',
  'reuse_notified',
];
