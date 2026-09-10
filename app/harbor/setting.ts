/** East = +x, north = -z. Distances are compressed, not survey coordinates.
 * Qianhai Stone means the existing 前湾 park, not the proposed 大铲湾段.
 * See references.md: only the wheel/stone anchors have verified map coordinates.
 */
export const HARBOR = {
  seed: 20260910,
  radius: 23,
  hubHeight: 25.1,
  cabins: 28,
  rideSeconds: 120,
  duskSeconds: 90,
  spawn: [0, 0.04, -12] as const,
  entrance: [0, 0.04, -5] as const,
  landmarks: [
    {
      id: 'stone',
      name: '前海石公园',
      detail: '南侧 · 草坪与前海石',
      point: [9, 5, 100],
    },
    {
      id: 'penguin',
      name: '企鹅岛',
      detail: '西南 · 大铲湾腾讯园区',
      point: [-105, 21, 150],
    },
    {
      id: 'cbd',
      name: '前海 CBD',
      detail: '东南远岸 · 城市灯火',
      point: [87, 32, 192],
    },
  ],
} as const;
