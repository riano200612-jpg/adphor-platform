import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {createIamEdgeAdapter} from './iam-edge-adapter.js';

// Solo este proyecto Supabase QA; las credenciales de servicio se leen del entorno privado.
const handler=createIamEdgeAdapter(createClient);
Deno.serve((request)=>handler(request,{
  QA_REF:Deno.env.get('SUPABASE_PROJECT_REF') || 'qfctnnnnltghepwujpdm',
  SUPABASE_SERVICE_ROLE_KEY:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
}));
