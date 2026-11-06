import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { data, error } = await supabase
    .from('drafts')
    .select('id, author_id, title, status, current_version')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: 'Unable to fetch draft' },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Draft not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ draft: data });
}