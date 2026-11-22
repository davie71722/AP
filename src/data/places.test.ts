import { describe, expect, it } from 'vitest';
import { brigadeOrder, FIRE_UNITS, unitsOf } from './places';

describe('選車：大隊順序', () => {
  it('芎林屬第三大隊', () => {
    expect(FIRE_UNITS.find((u) => u.name === '芎林')?.brigade).toBe('第三大隊');
  });
  it('轄區大隊排最上方，其餘依大隊順序；轄區分隊排第一', () => {
    expect(brigadeOrder('芎林')).toEqual(['第三大隊', '第一大隊', '第二大隊', '第四大隊']);
    expect(brigadeOrder('寶山')).toEqual(['第四大隊', '第一大隊', '第二大隊', '第三大隊']);
    expect(brigadeOrder(undefined)).toEqual(['第一大隊', '第二大隊', '第三大隊', '第四大隊']);
    expect(unitsOf('第三大隊', '關西')[0].name).toBe('關西');
  });
});
