/** 哔哩哔哩视频卡片保留的标识，供未来媒体后处理功能使用。 */
export interface RepostExtraParams {
  bvid: string;
  aid: number;
  cid: number;
  type: "video" | "opus";
}
