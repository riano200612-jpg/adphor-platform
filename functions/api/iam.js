import {createClient} from '@supabase/supabase-js';
import {createIamQaHandler} from '../../src/qa-gates/iam-api-gate.js';

// Enabled only with explicit QA-only runtime controls; no production access.
export const onRequest=createIamQaHandler(createClient);
