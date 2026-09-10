/** Distances, headings and duration are narrative compression, not navigation data. */
export const BAY = {
  title: '海风抵达清晨',
  note: '深圳湾 · 艺术化压缩海岸 · 冬日记忆',
  storageKey: 'shenzhen-memory:bay:v1',
  sunriseSeconds: 75,
  gullSeconds: 10,
  spawn: [-46, -7] as const,
  bicycle: [-43, 0] as const,
  lookout: [0, 7] as const,
  parking: [36, 6] as const,
  lawn: [36, -10] as const,
  chapters: {
    bicycle: [
      '01 / 借一阵海风',
      '先走到自行车旁。上车后，沿珊瑚色车道向前，海一直在右手边。',
    ],
    gulls: [
      '02 / 在海鸥经过的地方',
      '到中途观景平台附近刹车，下车看海鸥。只远远看着，不投喂、不追逐。',
    ],
    theatre: [
      '03 / 清晨还在前面',
      '继续骑到日出剧场的停车区。停稳下车，再走上临海草坡。',
    ],
    sunrise: [
      '04 / 躺下来，等城市醒来',
      '在草坡上躺一会儿，看看海面、深超总与福田的隐约轮廓。随时可以起身，晨曦进度会保留。',
    ],
    complete: [
      '海风抵达清晨 · 已收藏',
      '风从昨夜吹过来，抵达了今天的第一束光。你可以继续看海，也可以回到星球。',
    ],
  },
  ui: {
    mount: '上车',
    dismount: '安全下车',
    gulls: '看海鸥',
    sunrise: '躺下看日出',
    leave: '结束观看 / 起身',
    pedal: '踩踏',
    brake: '刹车',
    left: '向左',
    right: '向右',
    forward: '向前',
    backward: '向后',
    boost: '加速',
    guide: '沿路线前进',
    stopGuide: '自己控制',
    sound: '开启海浪、风声与鸟鸣',
    mute: '关闭环境声',
    controls:
      'W / ↑ 踩踏 · A D 转向 · S / ↓ / 空格刹车 · Shift 加速 · E 上下车 / 互动',
    walkControls: 'WASD / 方向键步行 · 空格跳跃 · E 互动 · 拖动观察',
    unsafe: '这里没有足够的安全空间，请移到开阔地面。',
    moving: '请先刹车停稳，再下车。',
    gullWait: '海鸥掠过水面，也把匆忙留在了身后。',
    gullSaved: '海鸥记忆已保存，可以继续向日出剧场出发。',
    parking: '请将车骑到日出剧场停车区，停稳后下车。',
    hill: '停车完成，沿浅色小径走上草坡。',
    saved: '进度保存在此浏览器',
    saveFailed: '浏览器暂时无法保存；仍可继续本次体验',
    audioFailed: '环境声暂不可用，可再次点击尝试；不影响体验。',
    fold: '收起介绍',
    unfold: '展开介绍',
    reset: '重置观察视角',
    return: '返回记忆星球',
  },
} as const;
export const coastZ = (x: number) => 6 * Math.sin(x / 24);
export const cyclePoint = (x: number): [number, number] => [x, coastZ(x)];
export const terrainY = (x: number, z: number) =>
  3 *
  Math.exp(-(((x - 36) / 12) ** 2) - ((z + 10) / 11) ** 2) *
  Math.min(1, Math.max(0, (coastZ(x) - z - 3) / 5));
