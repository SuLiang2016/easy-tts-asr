export interface Voice {
  id: string;
  name: string;
  description: string;
  category: "featured" | "fun";
  language?: string;
}

export const VOICES: Voice[] = [
  { id: "zh_female_vv_uranus_bigtts", name: "文档示例女声", description: "Agent Plan HTTP 示例 speaker", category: "featured", language: "zh" },
];

export const FEATURED_VOICES = VOICES.filter((v) => v.category === "featured");
export const FUN_VOICES = VOICES.filter((v) => v.category === "fun");
