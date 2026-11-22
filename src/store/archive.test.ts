import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { useStore } from './store';
import { listArchives } from './db';

describe('案件存檔', () => {
  it('案件結束自動存檔、清除前存檔、可載入', async () => {
    const st = useStore.getState();
    st.addPatient('R', 'A');
    st.addPatient('Y');
    const startAt = useStore.getState().incident.startAt!;
    useStore.getState().endIncident();
    await new Promise((r) => setTimeout(r, 50));
    let rows = await listArchives();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(`case-${startAt}`);
    expect(rows[0].total).toBe(2);
    expect(rows[0].endAt).not.toBeNull();

    // 重新開啟後再加人，清除事件 → 覆寫同一筆
    useStore.getState().reopenIncident();
    useStore.getState().addPatient('G');
    useStore.getState().clearIncident();
    await new Promise((r) => setTimeout(r, 50));
    rows = await listArchives();
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(3);
    expect(useStore.getState().patients).toHaveLength(0);

    // 載入為目前案件
    expect(await useStore.getState().loadArchive(rows[0].id)).toBe(true);
    expect(useStore.getState().patients.map((p) => p.label)).toEqual(['紅1-A', '黃1', '綠1']);
    expect(useStore.getState().incident.startAt).toBe(startAt);
  });
});
