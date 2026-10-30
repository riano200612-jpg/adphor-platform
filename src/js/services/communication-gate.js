/** Outbound communications are OFF unless administrator approval AND verified QA configuration are present.
 * Fail closed; this check must also be repeated by server-side delivery workers.
 */
export function assertOutboundAuthorized({adminApproved=false,providerConfigured=false,environment='qa'}={}) {
  if(environment==='qa' || !adminApproved || !providerConfigured) {
    throw new Error('Envío bloqueado hasta autorización administrativa explícita y proveedor verificado.');
  }
  return true;
}
