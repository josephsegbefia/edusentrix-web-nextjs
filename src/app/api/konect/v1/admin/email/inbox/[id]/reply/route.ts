import mongoose from 'mongoose';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/db/connectToDatabase';
import { requireSchoolAdminOrDelegatedAnyPermission } from '@/lib/delegations/requireDelegatedModulePermission';
import { EmailThread } from '@/models/EmailThread';
import { EmailMessage } from '@/models/EmailMessage';
import { sendTrackedBrevoEmail } from '@/lib/email';
import { escapeReplyHtml, selectReplyRecipient, validReplyIdempotencyKey } from '@/lib/konect/communication/reply-policy';
const BodySchema = z.object({ body: z.string().trim().min(1, 'Message is required').max(12000, 'Message is too long') });
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireSchoolAdminOrDelegatedAnyPermission(['email.send']); await connectToDatabase(); const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid thread id' }, { status: 400 });
    const idempotencyKey = (req.headers.get('Idempotency-Key') || '').trim(); if (!validReplyIdempotencyKey(idempotencyKey)) return NextResponse.json({ success: false, error: 'A valid Idempotency-Key header is required' }, { status: 400 });
    const parsed = BodySchema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid message' }, { status: 400 });
    const schoolId = String(viewer.schoolId); const existing = await EmailMessage.findOne({ schoolId, threadId: id, idempotencyKey }).lean(); if (existing) return NextResponse.json({ success: true, data: { messageId: String(existing._id), threadId: String(existing.threadId || id), status: existing.status, replayed: true } }, { status: existing.status === 'failed' ? 422 : 200 });
    const thread: any = await EmailThread.findOne({ _id: id, mailboxScope: 'school', schoolId: viewer.schoolId, status: { $ne: 'archived' } }).lean(); if (!thread) return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
    const participants = (thread.participants || []).filter((p: any) => typeof p.email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email));
    const inbound: any = await EmailMessage.findOne({ threadId: thread._id, schoolId: viewer.schoolId, direction: 'inbound' }).sort({ createdAt: -1, _id: -1 }).lean();
    const recipient = selectReplyRecipient(participants, inbound?.from);
    if (!recipient || (participants.length > 1 && !inbound)) return NextResponse.json({ success: false, error: 'Reply recipient is ambiguous for this conversation' }, { status: 409 });
    const subject = /^re:/i.test(thread.subject || '') ? thread.subject : `Re: ${thread.subject || '(No subject)'}`;
    const references = [...(inbound?.referencesHeader || []), ...(inbound?.messageIdHeader ? [inbound.messageIdHeader] : [])];
    const result = await sendTrackedBrevoEmail({ to: recipient.email, toName: recipient.name || null, subject, htmlContent: `<div>${escapeReplyHtml(parsed.data.body)}</div>`, textContent: parsed.data.body, templateKey: 'SCHOOL_MANUAL_EMAIL', schoolId, threadId: String(thread._id), threadType: thread.threadType === 'manual' ? 'manual' : 'school_ops', actorId: String(viewer.userId), actorRole: viewer.isSchoolAdmin ? 'school_admin' : 'delegate', recipientUserId: recipient.userId ? String(recipient.userId) : null, recipientRole: recipient.roleHint || null, idempotencyKey, inReplyTo: inbound?.messageIdHeader || null, referencesHeader: references, enqueueOnFailure: true });
    return NextResponse.json({ success: true, data: { ...result, replayed: false } }, { status: result.status === 'failed' ? 502 : 202 });
  } catch (error) { if (error instanceof NextResponse) return error; if (error instanceof Error && error.message.includes('duplicate key')) return NextResponse.json({ success: false, error: 'Duplicate request is still being processed; retry with the same key' }, { status: 409 }); return NextResponse.json({ success: false, error: 'Unable to send reply' }, { status: 500 }); }
}
