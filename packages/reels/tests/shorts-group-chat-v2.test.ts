import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUP_CHAT_SPEC_V2,
  GROUP_CHAT_V2_REPRESENTATION_WINDOWS,
  groupChatV2RepresentationAt,
} from '../src/shorts/group-chat-croatia-england';
import { shortDuration } from '../src/shorts/spec';

describe('Group Chat Croatia–England V2', () => {
  it('stays inside the approved 12.8–13.3 second delivery window', () => {
    assert.equal(Number(shortDuration(GROUP_CHAT_SPEC_V2).toFixed(2)), 13.1);
  });

  it('never shows one message in two representations at the same time', () => {
    for (const window of GROUP_CHAT_V2_REPRESENTATION_WINDOWS) {
      const sameMessage = GROUP_CHAT_V2_REPRESENTATION_WINDOWS.filter((candidate) => candidate.messageId === window.messageId);
      for (const candidate of sameMessage) {
        if (candidate === window) continue;
        assert.ok(
          window.to <= candidate.from || candidate.to <= window.from,
          `${window.messageId} overlaps as ${window.kind} and ${candidate.kind}`,
        );
      }
    }
  });

  it('hands DELETE THAT cleanly from chat UI to takeover to the physical world', () => {
    assert.equal(groupChatV2RepresentationAt('delete-that', 6.09), 'ui');
    assert.equal(groupChatV2RepresentationAt('delete-that', 6.1), 'takeover');
    assert.equal(groupChatV2RepresentationAt('delete-that', 6.39), 'takeover');
    assert.equal(groupChatV2RepresentationAt('delete-that', 6.4), 'physical');
  });
});
