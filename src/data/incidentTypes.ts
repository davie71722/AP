// 事件類型規則包（規格書 5.2）。新增類型只需在此加物件，不需改演算法。
//
// hospitalBonus 鍵值語法： "[條件->]醫院條件"
//   條件（可省略）：red | yellow | green | patientTag:<tag>
//   醫院條件：tag:<tag> | level:<level> | traumaLevel:<level>

export interface IncidentType {
  id: string;
  name: string;
  trauma: boolean;
  hospitalBonus: Record<string, number>;
  patientTags: string[];
  dispatchRequires: string[];
  vehicleAfterTransport?: 'decon';
  alerts: string[];
}

export const INCIDENT_TYPES: IncidentType[] = [
  {
    id: 'hazmat',
    name: '化災',
    trauma: true,
    hospitalBonus: { 'tag:hazmat': 70 },
    patientTags: ['decontaminated', 'inhalation'],
    dispatchRequires: ['decontaminated'],
    vehicleAfterTransport: 'decon',
    alerts: ['上風處設集結區', '記錄化學物質名稱並通報收治醫院', '未除污傷患不可派車'],
  },
  {
    id: 'fire',
    name: '火災',
    trauma: true,
    hospitalBonus: { 'patientTag:burn->tag:burn': 45 },
    patientTags: ['burn', 'inhalation'],
    dispatchRequires: [],
    alerts: ['注意一氧化碳／氰化物中毒', '高壓氧需求另行確認收治醫院'],
  },
  {
    id: 'collapse',
    name: '倒塌／地震',
    trauma: true,
    hospitalBonus: { 'patientTag:crush->level:heavy': 20 },
    patientTags: ['crush'],
    dispatchRequires: [],
    alerts: ['傷患會陸續救出，持續追加並重算', '地震時先確認各院是否受損（必要時關閉）', '道路可能中斷，請修正車程'],
  },
  {
    id: 'traffic',
    name: '車禍',
    trauma: true,
    hospitalBonus: { 'red->traumaLevel:heavy': 15 },
    patientTags: [],
    dispatchRequires: [],
    alerts: ['國道事故注意行車方向與最近交流道，回程可能不同於去程'],
  },
  {
    id: 'explosion',
    name: '爆炸',
    trauma: true,
    hospitalBonus: { 'patientTag:burn->tag:burn': 45 },
    patientTags: ['blast', 'penetrating', 'burn'],
    dispatchRequires: [],
    alerts: ['爆震肺可能延遲出現，綠傷需再檢傷', '注意二次爆炸風險', '若涉刑案，配合警方管制與證據保全'],
  },
  {
    id: 'medical',
    name: '其他（非創傷）',
    trauma: false,
    hospitalBonus: {},
    patientTags: [],
    dispatchRequires: [],
    alerts: ['不使用外傷分級，改以一般急診與加護量能判斷'],
  },
];

export const INCIDENT_TYPE_BY_ID: Record<string, IncidentType> = Object.fromEntries(
  INCIDENT_TYPES.map((t) => [t.id, t]),
);
