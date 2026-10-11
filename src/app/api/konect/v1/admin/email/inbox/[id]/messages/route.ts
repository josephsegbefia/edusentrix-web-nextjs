import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/db/connectToDatabase';
import { requireSchoolAdminOrDelegatedModuleView } from '@/lib/delegations/requireDelegatedModulePermission';
import { EmailThread } from '@/models/EmailThread';
import { EmailMessage } from '@/models/EmailMessage';
import { safePlainText } from '@/lib/konect/communication/plaintext';
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const viewer = await requireSchoolAdminOrDelegatedModuleView('email'); await connectToDatabase(); const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid thread id' }, { status: 400 });
    const thread: any = await EmailThread.findOne({ _id: id, mailboxScope: 'school', schoolId: viewer.schoolId }).select('_id participants').lean(); if (!thread) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    const url = new URL(req.url); const page = Math.max(1, Number(url.searchParams.get('page') || 1) || 1); const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 50) || 50)); const total = await EmailMessage.countDocuments({ threadId: thread._id, schoolId: viewer.schoolId });
    const messages: any[] = await EmailMessage.find({ threadId: thread._id, schoolId: viewer.schoolId }).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean();
    const rows = messages.map(message => ({ id: String(message._id), direction: message.direction === 'inbound' || message.direction === 'outbound' ? message.direction : 'unknown', senderLabel: message.fromName || (message.direction === 'outbound' ? 'School' : 'Correspondent'), subject: message.subject || '(No subject)', bodyText: safePlainText(message.textBody, message.htmlBody), status: message.status, createdAt: message.createdAt ?? null, attachments: (message.attachments || []).map((a: any) => ({ name: a.name || 'Attachment', mimeType: a.mimeType || 'application/octet-stream', sizeBytes: typeof a.sizeBytes === 'number' ? a.sizeBytes : null, generated: a.generated === true })) }));
    const participantNames = (thread.participants || []).map((participant: any) => participant.name).filter((name: unknown): name is string => typeof name === 'string' && Boolean(name.trim()));
    return NextResponse.json({ success: true, rows, page, limit, hasMore: page * limit < total, replyRecipientName: participantNames.length === 1 ? participantNames[0] : null });
  } catch (error) { if (error instanceof NextResponse) return error; return NextResponse.json({ success: false, error: 'Unable to load messages' }, { status: 500 }); }
}
