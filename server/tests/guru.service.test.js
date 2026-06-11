import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGuruResponseText } from '../src/services/guru.service.js';

describe('normalizeGuruResponseText', () => {
  it('decodes common HTML entities before returning chat text', () => {
    assert.equal(
      normalizeGuruResponseText('El &quot;Colorado&quot; viene filoso &amp; picante.'),
      'El "Colorado" viene filoso & picante.',
    );
  });

  it('decodes entities that were escaped more than once', () => {
    assert.equal(
      normalizeGuruResponseText('Ojo con &amp;quot;ese partido&amp;quot;.'),
      'Ojo con "ese partido".',
    );
  });
});
