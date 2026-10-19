/**
 * B 站动态（opus / t）相关类型。
 *
 * 目前使用两个上游接口：
 *  - `/x/polymer/web-dynamic/desktop/v1/detail`：通用动态详情，opus / t 均可命中，
 *    返回结构统一（MODULE_TYPE_AUTHOR / DESC / DYNAMIC / STAT）。
 *  - `/x/polymer/web-dynamic/v1/opus/detail`：图文（opus）详情，额外提供标题与
 *    完整正文段落，用于增强 `/opus/` 链接的解析结果。
 *
 * 另外还定义了供转发侧消费的归一化模型 {@link BilibiliDynamic}。
 */

/* -------------------------------------------------------------------------- */
/* 通用：富文本节点                                                            */
/* -------------------------------------------------------------------------- */

export type RichTextNodeType =
  | 'RICH_TEXT_NODE_TYPE_TEXT'
  | 'RICH_TEXT_NODE_TYPE_AT'
  | 'RICH_TEXT_NODE_TYPE_WEB'
  | 'RICH_TEXT_NODE_TYPE_EMOJI'
  | 'RICH_TEXT_NODE_TYPE_TOPIC'
  | 'RICH_TEXT_NODE_TYPE_LOTTERY'
  | 'RICH_TEXT_NODE_TYPE_BV'
  | (string & {});

export interface RichTextNode {
  type: RichTextNodeType;
  /** 展示文本 */
  text?: string;
  /** 原始文本，如 `[doge]` / 完整 URL */
  orig_text?: string;
  /** 跳转链接（话题 / 网页 / 抽奖等） */
  jump_url?: string;
  /** 关联 ID（@ 的 mid、话题 id 等） */
  rid?: string;
  emoji?: { icon_url: string; size?: number; text?: string } | null;
}

/* -------------------------------------------------------------------------- */
/* desktop/v1/detail 响应                                                      */
/* -------------------------------------------------------------------------- */

/** 动态类型（上游 `item.type`） */
export type BilibiliDynamicType =
  | 'DYNAMIC_TYPE_AV'
  | 'DYNAMIC_TYPE_DRAW'
  | 'DYNAMIC_TYPE_WORD'
  | 'DYNAMIC_TYPE_ARTICLE'
  | 'DYNAMIC_TYPE_FORWARD'
  | 'DYNAMIC_TYPE_LIVE_RCMD'
  | 'DYNAMIC_TYPE_NONE'
  | (string & {});

export interface BilibiliDynamicDetailPayload {
  code: number;
  message: string;
  ttl?: number;
  data?: { item?: BilibiliDynamicItem };
}

export interface BilibiliDynamicItem {
  id_str: string;
  type: BilibiliDynamicType;
  visible?: boolean;
  basic?: {
    rid_str?: string;
    rtype?: number;
    comment_id_str?: string;
    comment_type?: number;
    title?: string;
    uid?: number | string;
  };
  modules: BilibiliDynamicModule[];
}

export type BilibiliDynamicModuleType =
  | 'MODULE_TYPE_AUTHOR'
  | 'MODULE_TYPE_DESC'
  | 'MODULE_TYPE_DYNAMIC'
  | 'MODULE_TYPE_STAT'
  | (string & {});

export interface BilibiliDynamicModule {
  module_type: BilibiliDynamicModuleType;
  module_author?: BilibiliDynamicModuleAuthor | null;
  module_desc?: BilibiliDynamicModuleDesc | null;
  module_dynamic?: BilibiliDynamicModuleDynamic | null;
  module_stat?: BilibiliDynamicModuleStat | null;
}

export interface BilibiliDynamicModuleAuthor {
  /** 秒级时间戳 */
  pub_ts?: number | string;
  pub_text?: string;
  user?: {
    mid: number;
    name: string;
    face: string;
  } | null;
}

export interface BilibiliDynamicModuleDesc {
  text?: string;
  rich_text_nodes?: RichTextNode[];
}

export type BilibiliDynamicMajorType =
  | 'MDL_DYN_TYPE_ARCHIVE'
  | 'MDL_DYN_TYPE_DRAW'
  | 'MDL_DYN_TYPE_FORWARD'
  | 'MDL_DYN_TYPE_ARTICLE'
  | 'MDL_DYN_TYPE_LIVE_RCMD'
  | (string & {});

export interface BilibiliDynamicModuleDynamic {
  type: BilibiliDynamicMajorType;
  dyn_archive?: BilibiliDynArchive | null;
  dyn_draw?: BilibiliDynDraw | null;
  dyn_forward?: { item?: BilibiliDynamicItem | null } | null;
  dyn_article?: BilibiliDynArticle | null;
}

/** 投稿视频 */
export interface BilibiliDynArchive {
  aid?: string;
  bvid?: string;
  cover?: string;
  title?: string;
  desc?: string;
  /** 形如 `07:22` */
  duration_text?: string;
  jump_url?: string;
  stat?: { play?: string; danmaku?: string; like?: string } | null;
}

/** 图片动态 */
export interface BilibiliDynDraw {
  id?: number;
  items?: BilibiliDynDrawItem[];
}

export interface BilibiliDynDrawItem {
  src: string;
  width?: number;
  height?: number;
  /** 上游单位为 KB */
  size?: number;
}

/** 专栏 / 图文卡片 */
export interface BilibiliDynArticle {
  id?: number;
  title?: string;
  desc?: string;
  covers?: string[];
  jump_url?: string;
}

export interface BilibiliDynamicStatItem {
  count?: number;
}

export interface BilibiliDynamicModuleStat {
  like?: BilibiliDynamicStatItem | null;
  comment?: BilibiliDynamicStatItem | null;
  forward?: BilibiliDynamicStatItem | null;
}

/* -------------------------------------------------------------------------- */
/* v1/opus/detail 响应                                                         */
/* -------------------------------------------------------------------------- */

export interface BilibiliOpusDetailPayload {
  code: number;
  message: string;
  ttl?: number;
  data?: { item?: BilibiliOpusItem };
}

export interface BilibiliOpusItem {
  id_str: string;
  type?: number | string;
  basic?: { title?: string; uid?: number | string; rid_str?: string };
  modules: BilibiliOpusModule[];
}

export interface BilibiliOpusModule {
  module_type?: string;
  module_top?: { display?: { album?: { pics?: BilibiliOpusPic[] } | null } | null } | null;
  module_title?: { text?: string } | null;
  module_author?: BilibiliOpusModuleAuthor | null;
  module_content?: BilibiliOpusModuleContent | null;
  module_stat?: BilibiliDynamicModuleStat | null;
}

export interface BilibiliOpusModuleAuthor {
  mid: number;
  name: string;
  face: string;
  /** 秒级时间戳，opus 接口返回字符串 */
  pub_ts?: number | string;
  pub_time?: string;
}

export interface BilibiliOpusPic {
  url: string;
  width?: number;
  height?: number;
  /** 上游单位为 KB */
  size?: number;
}

export interface BilibiliOpusModuleContent {
  paragraphs?: BilibiliOpusParagraph[];
}

export interface BilibiliOpusParagraph {
  /** 1: 文本; 2: 图片 */
  para_type: 1 | 2 | number;
  text?: { nodes?: BilibiliOpusParagraphNode[] } | null;
  pic?: { pics?: BilibiliOpusPic[] } | null;
}

export interface BilibiliOpusParagraphNode {
  type: 'TEXT_NODE_TYPE_WORD' | 'TEXT_NODE_TYPE_RICH' | (string & {});
  word?: { words?: string } | null;
  rich?: { text?: string; orig_text?: string; type?: RichTextNodeType } | null;
}

/* -------------------------------------------------------------------------- */
/* 归一化模型                                                                  */
/* -------------------------------------------------------------------------- */

/** 动态链接类型；opus: 图文动态，t: 普通动态 */
export type BilibiliDynamicKind = 'opus' | 't';

export interface BilibiliDynamicAuthor {
  mid: number;
  name: string;
  face: string;
}

export interface BilibiliDynamicImage {
  url: string;
  width?: number;
  height?: number;
  /** KB */
  size?: number;
}

export interface BilibiliDynamicVideo {
  bvid?: string;
  aid?: number;
  cover?: string;
  title?: string;
  desc?: string;
  durationText?: string;
  playText?: string;
  danmakuText?: string;
}

export interface BilibiliDynamicStat {
  like: number;
  comment: number;
  forward: number;
}

/** 供转发侧消费的动态归一化结果 */
export interface BilibiliDynamic {
  id: string;
  kind: BilibiliDynamicKind;
  dynamicType: BilibiliDynamicType;
  author: BilibiliDynamicAuthor;
  /** 毫秒级时间戳 */
  publishAt: number;
  title?: string;
  text: string;
  images: BilibiliDynamicImage[];
  video?: BilibiliDynamicVideo;
  stat: BilibiliDynamicStat;
  /** 转发动态的源动态 */
  origin?: BilibiliDynamic;
}
