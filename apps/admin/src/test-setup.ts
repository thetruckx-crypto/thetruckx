import { test } from 'vitest';
import * as fc from 'fast-check';
import { itProp } from '@fast-check/vitest';

// Make fast-check's property testing available globally
(globalThis as any).fc = fc;
(globalThis as any).itProp = itProp;
