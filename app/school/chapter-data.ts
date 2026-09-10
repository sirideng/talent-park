/** Editable memory script. Coordinates/layout are artistic inference, not a survey. */
export const SCHOOL_CHAPTER = {
  title: '放学后',
  subtitle: '北京师范大学南山附属中学',
  note: '旧校园意象 · 布局为艺术化推断',
  estimate: '约 5—8 分钟 · 不计排名，也不用赶时间',
  storageKey: 'shenzhen-memory:school:v1',
  practice: {
    repetitions: 6,
    cycleSeconds: 14,
    window: [0.22, 0.85],
    encouragement: [
      '先找到自己的呼吸。',
      '比刚才稳了一点。',
      '歇一口气，再来。',
      '这一次，也算进步。',
      '有人在旁边等你。',
      '今天的努力，就留在这里。',
    ],
  },
  run: { radiusX: 34, radiusZ: 22, checkpoints: 64, speed: 1.25 },
  sunsetSeconds: 80,
  moonSeconds: 25,
  spots: {
    spawn: [0, 37],
    bars: [40, -8],
    track: [34, 0],
    seat: [0, 29],
    moon: [0, 0],
    gate: [0, 45],
  },
  practiceAnchor: [40, -9.75],
  steps: {
    arrival: {
      title: '01 / 再多做一个',
      text: '操场还留着白天的温度。去单杠边，慢慢找到自己的节奏。',
      action: '开始练习',
    },
    practice: {
      title: '01 / 一次次进步',
      text: '光环变亮时按 E 或轻点按钮。错过也没关系，下一次呼吸还会来。',
      action: '轻轻拉起',
    },
    run: {
      title: '02 / 再并肩一圈',
      text: '沿跑道跟随前方光点，走过一整圈。身旁的影子不催促，只陪你往前。',
      action: '跟随光点慢跑',
    },
    rest: {
      title: '03 / 留下来的是日落',
      text: '训练结束了。走到看台前，坐一会儿，把这一小段黄昏留给自己。',
      action: '坐下看日落',
    },
    home: {
      title: '记忆已解锁 / 放学后',
      text: '那时只想着再多做一个、再快一点。后来记住的，却是一起看过的日落和回家的路。',
      action: '沿灯光回校门',
    },
    complete: {
      title: '放学后 · 已收藏',
      text: '回家的路亮起来了。这段记忆留在这台设备里，你随时可以回来走走。',
      action: '返回记忆星球',
    },
  },
  moon: {
    title: '彩蛋 / 初三的中秋',
    hint: '草坪中央有一圈很轻的月光。',
    action: '坐在草坪看月亮',
    text: '初三的中秋傍晚，我们坐在草地上。月亮升起来，话题从明天，飘到很远的未来。',
    ending: '那时候，未来还很远。我们却已经一起抬起了头。',
  },
  ui: {
    guide: '带我走过去',
    stopGuide: '自己走一会儿',
    leaveSeat: '起身',
    moonLeave: '回到这个傍晚',
    replay: '再走一遍',
    saved: '已保存在此设备',
    saveFailed: '浏览器暂时不能保存；本次仍可继续体验',
    controls: 'WASD / 方向键 · Shift 加速 · 空格跳跃 · 拖动观察',
    waiting: '慢慢呼吸，等下一次光亮',
    success: '很好，休息一口气。',
    early: '没关系，等光亮再试一次。',
    sunset: '不用做什么，陪夕阳再待一会儿。',
    moonSaved: '已收藏 · 初三的中秋',
    lap: '一起跑过的这一圈',
    afterSchoolSaved: '已收藏 · 放学后',
    fold: '收起介绍',
    unfold: '展开介绍',
    rhythm: '练习节奏',
    move: ['向前', '向左', '向后', '向右'],
    back: '返回记忆星球',
  },
} as const;
export type ChapterStep = keyof typeof SCHOOL_CHAPTER.steps;
export const trackPoint = (index: number): [number, number] => {
  const a = (index / SCHOOL_CHAPTER.run.checkpoints) * Math.PI * 2;
  return [
    Math.cos(a) * SCHOOL_CHAPTER.run.radiusX,
    Math.sin(a) * SCHOOL_CHAPTER.run.radiusZ,
  ];
};
