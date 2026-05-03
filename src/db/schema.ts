import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'memos',
      columns: [
        { name: 'content', type: 'string' },
        { name: 'is_archived', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        // Supabase 연동을 위한 필드
        { name: 'supabase_id', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'calendar_blocks',
      columns: [
        { name: 'memo_id', type: 'string', isIndexed: true, isOptional: true }, // 관계형
        { name: 'title', type: 'string' },
        { name: 'start_date', type: 'number' }, // Timestamp
        { name: 'end_date', type: 'number', isOptional: true },
        { name: 'all_day', type: 'boolean' },
        { name: 'order', type: 'number' },
        { name: 'color', type: 'string', isOptional: true },
        { name: 'is_completed', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        // Supabase 연동을 위한 필드
        { name: 'supabase_id', type: 'string', isOptional: true },
      ],
    }),
  ],
});
