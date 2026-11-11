import test from 'node:test';
import assert from 'node:assert/strict';
import {visitDraftGuidance} from '../src/js/ui-visit-preparation.js';

test('visit preparation requires property, motive, date and scoped responsible', () => {
  const draft={projectId:'p1',kind:'Inspección',start:'2026-11-13T10:00',responsibleId:'u1',allowedResponsibleIds:['u1']};
  assert.match(visitDraftGuidance({...draft,projectId:''}),/copropiedad asignada/);
  assert.match(visitDraftGuidance({...draft,kind:' '}),/motivo/);
  assert.match(visitDraftGuidance({...draft,start:''}),/fecha/);
  assert.match(visitDraftGuidance({...draft,responsibleId:'other'}),/responsable autorizado/);
  assert.match(visitDraftGuidance(draft),/SQL aún no está habilitado/);
});
