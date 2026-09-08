import test from 'node:test';
import assert from 'node:assert/strict';
import { cardCopy, type ShareCardData } from '../src/share/card.ts';

test('share-card headlines reflect the player result without inventing wins', () => {
  const data = { myScore: 3, rivalScore: 1 } as ShareCardData;
  assert.equal(cardCopy(data).label, 'VICTORY');
  assert.equal(cardCopy({ ...data, myScore: 0 }).headline[0], 'THE REMATCH');
  assert.equal(cardCopy({ ...data, myScore: 1 }).label, 'DRAW');
});
