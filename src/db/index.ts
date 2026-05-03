import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import Memo from './models/Memo';
import CalendarBlock from './models/CalendarBlock';

// 1. Adapter 생성 (SQLite 기반)
const adapter = new SQLiteAdapter({
  schema,
  // (옵션) DB 마이그레이션 적용 가능
  // migrations, 
  // JSI 사용 여부 (iOS/Android 성능 최적화)
  jsi: true, 
  // 동기 모드 (개발 시 유용)
  onSetUpError: (error: any) => {
    console.error("WatermelonDB setup error", error);
  }
});

// 2. Database 인스턴스 생성
export const database = new Database({
  adapter,
  modelClasses: [
    Memo,
    CalendarBlock,
  ],
});
