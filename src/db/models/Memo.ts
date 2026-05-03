import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';

export default class Memo extends Model {
  static table = 'memos';

  static associations = {
    calendar_blocks: { type: 'has_many', foreignKey: 'memo_id' },
  } as const;

  @field('content') content!: string;
  @field('is_archived') isArchived!: boolean;
  @field('supabase_id') supabaseId?: string;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @children('calendar_blocks') calendarBlocks!: any;
}
