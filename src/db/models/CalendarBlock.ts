import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';

export default class CalendarBlock extends Model {
  static table = 'calendar_blocks';

  static associations = {
    memos: { type: 'belongs_to', key: 'memo_id' },
  } as const;

  @field('title') title!: string;
  @date('start_date') startDate!: Date;
  @date('end_date') endDate?: Date;
  @field('all_day') allDay!: boolean;
  @field('order') order!: number;
  @field('color') color?: string;
  @field('is_completed') isCompleted!: boolean;
  @field('supabase_id') supabaseId?: string;

  @readonly @date('created_at') createdAt!: Date;

  @relation('memos', 'memo_id') memo!: any;
}
