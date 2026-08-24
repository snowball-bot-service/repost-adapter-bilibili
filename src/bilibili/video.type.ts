/**
 * 视频基本信息请求负载
 */
export interface VideoInfoParams {
  bvid?: string;
  aid?: number;
}

/** 公共视频详情接口 `/x/web-interface/wbi/view` 的响应。 */
export interface BilibiliVideoInfoPayload {
  code: number;
  message: string;
  ttl: number;
  data?: BilibiliVideoInfo;
}

/** 当前信息卡转发所需的视频详情字段。 */
export interface BilibiliVideoInfo {
  bvid: string;
  aid: number;
  cid: number;
  pic: string;
  title: string;
  pubdate: number;
  desc: string;
  duration: number;
  tname: string;
  tname_v2?: string;
  owner: BilibiliVideoOwner;
  stat: BilibiliVideoStat;
}

export interface BilibiliVideoOwner {
  mid: number;
  name: string;
  face: string;
}

export interface BilibiliVideoStat {
  view: number;
  like: number;
  coin: number;
  favorite: number;
}

export interface VideoSnapshotParams extends VideoInfoParams {
  // 分P ID, 默认 1P
  cid?: number;
  // 是否获取json数组截取时间表; 1: 需要, 0: 不需要
  index?: number;
}

export interface VideoDownloadParams extends VideoInfoParams {
  cid: number;
  gaia_source?: string;
  qn?: number;
  fnval?: number;
  fnver?: 0;
  fourk?: 0 | 1;
  session?: string;
  otype?: "json";
  type?: string;
  platform?: "pc" | "html5";
  high_quality?: 0 | 1;
  try_look?: number;
}

export interface BilibiliVideoSnapshotPayload {
  code: number;
  message: string;
  ttl: number;
  data: VideoSnapshotData;
}

export interface VideoSnapshotData {
  // 二进制索引文件路径
  pvdata: string;
  // 横向缩略图数量
  img_x_len: number;
  // 纵向缩略图数量
  img_y_len: number;
  // 单张缩略图宽度
  img_x_size: number;
  // 单张缩略图高度
  img_y_size: number;
  // 图片列表
  image: string[];
  // 每帧对应缩略图的位置索引
  index?: number[];
}

export interface VideoDownloadInfoPayload {
  code: number;
  message: string;
  ttl: number;
  data: VideoDownloadInfoData;
}

export interface VideoDownloadInfoData {
  from: string;
  result: string;
  message: string;
  quality: number;
  format: string;
  timelength: number;
  accept_format: string;
  accept_description: string[];
  accept_quality: number[];
  video_codecid: number;
  seek_param: string;
  seek_type: string;
  durl: VideoDurlItem[];
  dash?: DashPayload;
  support_formats: VideoSupportFormat[];
  high_format: null | unknown;
  last_play_time: number;
  last_play_cid: number;
  view_info: null | unknown;
  play_conf: {
    is_new_description: boolean;
  };
  cur_language: string;
  cur_production_type: number;
}

export interface DashPayload {
  duration: number;
  minBufferTime: number;
  min_buffer_time: number;

  video: DashStream[];
  audio: DashStream[];
}

export interface DashStream {
  id: number;

  baseUrl: string;
  base_url: string;

  backupUrl?: string[];
  backup_url?: string[];

  bandwidth: number;

  mimeType: string;
  mime_type: string;

  codecs: string;

  width: number;
  height: number;

  frameRate: string;
  frame_rate: string;

  sar: string;

  startWithSap: number;
  start_with_sap: number;

  SegmentBase?: {
    Initialization: string;
    indexRange: string;
  };

  segment_base?: {
    initialization: string;
    index_range: string;
  };

  codecid: number;
}

export interface VideoDurlItem {
  order: number;
  length: number;
  size: number;
  ahead: string;
  vhead: string;
  url: string;
  backup_url: string[];
}

export interface VideoSupportFormat {
  quality: number;
  format: string;
  new_description: string;
  display_desc: string;
  superscript: string;
  codecs: string | null;
  can_watch_qn_reason: number;
  limit_watch_reason: number;
  report: Record<string, unknown>;
}
