import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/db/connectToDatabase';
import { requireSchoolAdminOrDelegatedModuleView } from '@/lib/delegations/requireDelegatedModulePermission';
import { EmailThread } from '@/models/EmailThread';
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const viewer = await requireSchoolAdminOrDelegatedModuleView('email'); await connectToDatabase(); const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'Invalid thread id' }, { status: 400 });
    const thread: any = await EmailThread.findOne({ _id: id, mailboxScope: 'school', schoolId: viewer.schoolId }).lean();
    if (!thread) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, rows: [{ id: String(thread._id), subject: thread.subject || '(No subject)', threadType: thread.threadType, status: thread.status, correspondent: (thread.participants || []).map((p: any) => ({ name: p.name || 'Correspondent', role: p.roleHint || 'Correspondent' })).slice(0, 3), participantCount: (thread.participants || []).length, lastMessagePreview: '', lastMessageAt: thread.lastMessageAt ?? null, unreadCount: thread.unreadCountSchool || 0 }], page: 1, limit: 1, hasMore: false });
  } catch (error) { if (error instanceof NextResponse) return error; return NextResponse.json({ success: false, error: 'Unable to load conversation' }, { status: 500 }); }
}
