export interface Voice {
  id: string;
  name: string;
  description: string;
  category: "featured" | "fun";
  language?: string;
}

// 火山引擎豆包语音合成模型音色
// 注意：voice_type 具体值需以火山控制台为准，这里使用常见示例值
export const VOICES: Voice[] = [
  // 精品音色
  { id: "zh_female_qingxin", name: "清新女声", description: "自然清新的年轻女声", category: "featured", language: "zh" },
  { id: "zh_female_wenrou", name: "温柔女声", description: "温柔细腻的女声", category: "featured", language: "zh" },
  { id: "zh_male_qingshuai", name: "清朗男声", description: "阳光清朗的年轻男声", category: "featured", language: "zh" },
  { id: "zh_male_chenwen", name: "沉稳男声", description: "成熟稳重的男声", category: "featured", language: "zh" },
  { id: "zh_female_kefu", name: "客服女声", description: "标准亲切的客服风格", category: "featured", language: "zh" },
  { id: "zh_male_zhubo", name: "解说男声", description: "适合解说、配音的男声", category: "featured", language: "zh" },
  { id: "zh_female_tongnian", name: "童声", description: "活泼可爱的儿童声音", category: "featured", language: "zh" },
  { id: "zh_female_youshi", name: "优雅女声", description: "优雅知性的女声", category: "featured", language: "zh" },
  { id: "zh_male_xinwen", name: "新闻男声", description: "端庄正式的新闻播报风格", category: "featured", language: "zh" },
  { id: "zh_female_gudian", name: "古风女声", description: "古典韵味的女声", category: "featured", language: "zh" },
  // 恶搞/特色音色
  { id: "zh_male_cartoon", name: "卡通大叔", description: "夸张的卡通人物声音", category: "fun", language: "zh" },
  { id: "zh_female_lolita", name: "萝莉音", description: "可爱软萌的萝莉声音", category: "fun", language: "zh" },
  { id: "zh_male_robot", name: "机器人", description: "机械感十足的机器人声音", category: "fun", language: "zh" },
  { id: "zh_male_fangyan", name: "方言老哥", description: "接地气的方言风格", category: "fun", language: "zh" },
  { id: "zh_female_monster", name: "小怪兽", description: "搞怪可爱的小怪兽声音", category: "fun", language: "zh" },
];

export const FEATURED_VOICES = VOICES.filter((v) => v.category === "featured");
export const FUN_VOICES = VOICES.filter((v) => v.category === "fun");
