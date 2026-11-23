import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { useStore } from './store';
import { listArchives } from './db';

describe('案件存檔', () => {
  it('案件結束自動存檔、清除前存檔、可載入', async () => {
    const st = useStore.getState();
    st.setCaseInfo({ name: '測試案件', drill: false });
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
    useStore.getState().clearIncident(); useStore.getState().setCaseInfo({ name: '測試案件', drill: false });
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

describe('留守車', () => {
  it('剩最後 2 位傷患才可派', () => {
    const st = useStore.getState();
    st.clearIncident(); useStore.getState().setCaseInfo({ name: '測試案件', drill: false });
    st.updateSettings({ firstVehicleHold: true });
    st.addVehicle('竹北', 91, 1, 1);
    const held = useStore.getState().vehicles[0];
    expect(held.held).toBe(true);
    for (let i = 0; i < 3; i++) useStore.getState().addPatient('Y');
    const ids = useStore.getState().patients.map((p) => p.id);
    useStore.getState().dispatchManual([ids[0]], held.id, 'tungyuan');
    expect(useStore.getState().patients[0].status).toBe('waiting');
    useStore.getState().releaseHold(held.id);
    expect(useStore.getState().vehicles[0].held).toBe(true);
    useStore.getState().deletePatient(ids[2]);
    useStore.getState().dispatchManual([ids[0]], held.id, 'tungyuan');
    expect(useStore.getState().patients[0].status).toBe('sent');
  });
});

describe('其他車輛（限綠牌）', () => {
  it('民間救護車載綠牌；紅黃不適用', () => {
    useStore.getState().clearIncident(); useStore.getState().setCaseInfo({ name: '測試案件', drill: false });
    useStore.getState().addPatient('G');
    useStore.getState().addPatient('Y');
    const [g, y] = useStore.getState().patients;
    useStore.getState().otherTransport([g.id, y.id], 'tungyuan', '民間救護車');
    const [g2, y2] = useStore.getState().patients;
    expect(g2.status).toBe('sent');
    expect(g2.byKind).toBe('民間救護車');
    expect(y2.status).toBe('waiting');
    useStore.getState().undo();
    expect(useStore.getState().patients[0].status).toBe('waiting');
  });
});

describe('個案照片', () => {
  it('上限 2 張；刪除歷史案件時一併刪除', async () => {
    const { addPhoto, listPhotos, putArchive, deleteArchive } = await import('./db');
    expect(await addPhoto('pp1', 'data:image/jpeg;base64,AAAA')).toBe(true);
    expect(await addPhoto('pp1', 'data:image/jpeg;base64,BBBB')).toBe(true);
    expect(await addPhoto('pp1', 'data:image/jpeg;base64,CCCC')).toBe(false);
    expect(await listPhotos('pp1')).toHaveLength(2);
    await putArchive({ id: 'case-x', savedAt: 1, startAt: 1, endAt: null, title: '', total: 1, data: { patients: [{ id: 'pp1' }] } });
    await deleteArchive('case-x');
    expect(await listPhotos('pp1')).toHaveLength(0);
  });
});

describe('合成照片保存', () => {
  it('存入案件，刪除歷史案件時一併刪除', async () => {
    const { putComposite, listComposites, putArchive, deleteArchive } = await import('./db');
    await putComposite({ patientId: 'cp1', at: 1, key: 'k', dataUrl: 'data:image/jpeg;base64,AAAA' });
    expect(await listComposites(['cp1', 'nope'])).toHaveLength(1);
    await putArchive({ id: 'case-y', savedAt: 1, startAt: 2, endAt: null, title: '', total: 1, data: { patients: [{ id: 'cp1' }] } });
    await deleteArchive('case-y');
    expect(await listComposites(['cp1'])).toHaveLength(0);
  });
});

describe('刪除所有演練案件', () => {
  it('刪除歷史中的演練案件與目前演練案件，正式案件保留', async () => {
    const { listArchives, addPhoto, listPhotos } = await import('./db');
    const wait = () => new Promise((r) => setTimeout(r, 60));
    const s = () => useStore.getState();
    // 先清掉前面測試留下的案件與存檔
    s().clearIncident(); useStore.getState().setCaseInfo({ name: '測試案件', drill: false }); await wait();
    for (const a of await listArchives()) await (await import('./db')).deleteArchive(a.id);
    // 演練案件 1：結束後自動存檔
    s().addPatient('R', 'A'); s().setDrill(true);
    const drillPid = s().patients[0].id;
    await addPhoto(drillPid, 'data:image/jpeg;base64,AAAA');
    s().endIncident(); await wait();
    // 正式案件
    s().clearIncident(); useStore.getState().setCaseInfo({ name: '測試案件', drill: false }); await wait();
    await new Promise((r) => setTimeout(r, 5));
    s().addPatient('Y'); s().endIncident(); await wait();
    // 目前：演練案件 2（未存檔）
    s().clearIncident(); useStore.getState().setCaseInfo({ name: '測試案件', drill: false }); await wait();
    await new Promise((r) => setTimeout(r, 5));
    s().addPatient('G'); s().setDrill(true);
    expect((await listArchives()).length).toBe(2);
    const n = await s().deleteAllDrills();
    expect(n).toBe(2);
    const left = await listArchives();
    expect(left).toHaveLength(1);
    expect(left[0].drill).toBe(false);
    expect(s().patients).toHaveLength(0);
    expect(await listPhotos(drillPid)).toHaveLength(0);
  });
});

describe('案件設定', () => {
  it('未設定名稱或真實／演練時不能開始事件、不能新增傷患', () => {
    const s = () => useStore.getState();
    s().clearIncident();
    useStore.setState((st) => ({ incident: { ...st.incident, name: '', drill: undefined } }));
    expect(s().startIncident(false)).toBe(false);
    s().addPatient('Y');
    expect(s().patients).toHaveLength(0);
    s().setCaseInfo({ name: '國1竹北段追撞' });
    expect(s().startIncident(false)).toBe(false);
    s().setCaseInfo({ drill: true });
    s().addPatient('Y');
    expect(s().patients).toHaveLength(1);
    expect(s().incident.startAt).not.toBeNull();
    expect(s().incident.log[0].text).toContain('事件開始：【演練】國1竹北段追撞');
  });
});
