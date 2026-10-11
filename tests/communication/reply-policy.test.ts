import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeReplyHtml, selectReplyRecipient, validReplyIdempotencyKey } from '@/lib/konect/communication/reply-policy';
test('reply policy requires bounded idempotency keys', () => { assert.equal(validReplyIdempotencyKey('short'), false); assert.equal(validReplyIdempotencyKey('konect-reply-2026-abcdef'), true); assert.equal(validReplyIdempotencyKey('unsafe key with spaces'), false); });
test('reply policy rejects ambiguous recipients and chooses a trusted inbound participant', () => { const participants = [{ email: 'one@example.com', name: 'One' }, { email: 'two@example.com', name: 'Two' }]; assert.equal(selectReplyRecipient(participants), null); assert.equal(selectReplyRecipient(participants, 'two@example.com')?.name, 'Two'); });
test('reply content is escaped before HTML rendering', () => { assert.equal(escapeReplyHtml('<script>x</script>\nhello'), '&lt;script&gt;x&lt;/script&gt;<br />hello'); });
