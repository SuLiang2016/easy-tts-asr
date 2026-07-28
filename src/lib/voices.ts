export interface Voice {
  id: string;
  name: string;
  description: string;
  category: "featured" | "fun";
  language?: string;
}

export const VOICES: Voice[] = [
  // 精品音色（10个）
  { id: "zh_female_vv_uranus_bigtts", name: "Vivi 2.0", description: "表现力强，情感丰富，支持多语种方言", category: "featured", language: "zh" },
  { id: "zh_female_xiaohe_uranus_bigtts", name: "小何 2.0", description: "温柔柔和，略带成熟的女声", category: "featured", language: "zh" },
  { id: "zh_male_m191_uranus_bigtts", name: "云舟 2.0", description: "沉稳大气，中音域男声", category: "featured", language: "zh" },
  { id: "zh_male_taocheng_uranus_bigtts", name: "小天 2.0", description: "活力四射，年轻男声", category: "featured", language: "zh" },
  { id: "zh_female_sophie_uranus_bigtts", name: "魅力苏菲 2.0", description: "平滑现代，柔和女声", category: "featured", language: "zh" },
  { id: "zh_female_qingxinnvsheng_uranus_bigtts", name: "清新女声 2.0", description: "清新自然，通用女声", category: "featured", language: "zh" },
  { id: "zh_female_tianmeixiaoyuan_uranus_bigtts", name: "甜美小源 2.0", description: "甜美温柔，适合情感陪伴", category: "featured", language: "zh" },
  { id: "zh_female_linjianvhai_uranus_bigtts", name: "邻家女孩 2.0", description: "亲切友善，温暖女声", category: "featured", language: "zh" },
  { id: "zh_male_ruyayichen_uranus_bigtts", name: "儒雅逸辰 2.0", description: "JARVIS 同款，成熟稳重男声", category: "featured", language: "zh" },
  { id: "zh_female_kefunvsheng_uranus_bigtts", name: "暖阳女声 2.0", description: "专业得体，客服场景女声", category: "featured", language: "zh" },

  // 恶搞/特色音色（5个）
  { id: "zh_male_sunwukong_uranus_bigtts", name: "猴哥 2.0", description: "孙悟空角色音，视频配音同款", category: "fun", language: "zh" },
  { id: "zh_female_peiqi_uranus_bigtts", name: "佩奇猪 2.0", description: "小猪佩奇卡通音，抖音豆包同款", category: "fun", language: "zh" },
  { id: "zh_female_ganmaodianyin_uranus_bigtts", name: "感冒电音姐姐 2.0", description: "感冒电音特效，魔性女声", category: "fun", language: "zh" },
  { id: "zh_male_naiqimengwa_uranus_bigtts", name: "奶气萌娃 2.0", description: "奶声奶气，幼童萌娃音", category: "fun", language: "zh" },
  { id: "zh_female_nvleishen_uranus_bigtts", name: "女雷神 2.0", description: "雷神角色音，霸气特效女声", category: "fun", language: "zh" },
];

export const FEATURED_VOICES = VOICES.filter((v) => v.category === "featured");
export const FUN_VOICES = VOICES.filter((v) => v.category === "fun");
