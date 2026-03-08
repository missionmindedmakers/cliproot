import { CRP_V0_0_1_SCHEMA } from './schema.js';
import type { FromJsonSchema } from './schema-to-types.js';

export type SppBundle = FromJsonSchema<typeof CRP_V0_0_1_SCHEMA>;
