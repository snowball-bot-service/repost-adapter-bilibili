/** 哔哩哔哩卡片保留的标识，供媒体后处理（🍓 原始视频等）使用。 */
export interface RepostExtraParams {
  /** video: 视频稿件; opus: 图文动态; t: 普通动态 */
  type: 'video' | 'opus' | 't';
  /** 视频稿件 BV 号；动态内嵌视频时同样存在 */
  bvid?: string;
  aid?: number;
  /** 分 P ID；动态内嵌视频时缺失，由进程侧按 bvid 补齐 */
  cid?: number;
  /** 动态 ID */
  dynamicId?: string;
}
