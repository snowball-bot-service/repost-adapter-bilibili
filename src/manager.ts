import type { AdapterContext } from '@snowball-bot/repost-adapter';
import type { BilibiliVideoInfo } from './bilibili/video.type';
import type {
  BilibiliDynamic,
  BilibiliDynamicAuthor,
  BilibiliDynamicImage,
  BilibiliDynamicItem,
  BilibiliDynamicKind,
  BilibiliDynamicModule,
  BilibiliDynamicModuleStat,
  BilibiliDynamicStat,
  BilibiliDynamicVideo,
  BilibiliOpusItem,
  BilibiliOpusModule,
  BilibiliOpusPic,
  RichTextNode,
} from './bilibili/dynamic.type';
import type { BilibiliCredentials } from './bilibili/security.type';
import { UnsupportedMethodException } from './utils/error';
import { HttpManager } from './utils/http';
import {
  dynamicFetchDetail,
  fetchBiliBuvid,
  fetchBiliTicket,
  opusFetchDetail,
  videoFetchInfo,
} from './utils/bilibili-api';
import dayjs from 'dayjs';

export interface BilibiliVideoHandle {
  method: 'post';
  type: 'video';
  id: string;
  query: { bvid?: string; aid?: number };
}

export interface BilibiliDynamicHandle {
  method: 'post';
  /** opus: 图文动态 (`/opus/<id>`); t: 普通动态 (`t.bilibili.com/<id>`) */
  type: BilibiliDynamicKind;
  id: string;
}

export type BilibiliHandle = BilibiliVideoHandle | BilibiliDynamicHandle;

const BILIBILI_HOSTS = new Set([
  'bilibili.com',
  'www.bilibili.com',
  'm.bilibili.com',
]);
const DYNAMIC_HOSTS = new Set(['t.bilibili.com', 'm.t.bilibili.com']);
const SHORT_HOSTS = new Set(['b23.tv', 'www.b23.tv']);

/** 解析 B 站视频 / 动态链接；短链会跟随重定向后再解析。 */
export async function extractHandleId(
  http: HttpManager,
  source: string
): Promise<BilibiliHandle> {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new UnsupportedMethodException(undefined, source);
  }

  const hostname = url.hostname.toLowerCase();

  if (SHORT_HOSTS.has(hostname)) {
    const response = await http.get(url.toString(), { retries: 0 });
    if (!response.url) throw new UnsupportedMethodException(undefined, source);
    return extractHandleId(http, response.url);
  }

  // t.bilibili.com/<dynamicId>
  if (DYNAMIC_HOSTS.has(hostname)) {
    const dynamicMatch = /^\/(\d+)(?:\/|$)/.exec(url.pathname);
    if (!dynamicMatch) throw new UnsupportedMethodException(undefined, source);
    return { method: 'post', type: 't', id: dynamicMatch[1] };
  }

  if (!BILIBILI_HOSTS.has(hostname)) {
    throw new UnsupportedMethodException(undefined, source);
  }

  // bilibili.com/opus/<dynamicId>
  const opusMatch = /^\/opus\/(\d+)(?:\/|$)/i.exec(url.pathname);
  if (opusMatch) {
    return { method: 'post', type: 'opus', id: opusMatch[1] };
  }

  const match = /^\/video\/(BV[\w]+|av\d+)(?:\/|$)/i.exec(url.pathname);
  if (!match) throw new UnsupportedMethodException(undefined, source);
  const id = match[1];

  return {
    method: 'post',
    type: 'video',
    id,
    query: id.toLowerCase().startsWith('av')
      ? { aid: Number(id.slice(2)) }
      : { bvid: id },
  };
}

/** 获取公开视频详情 */
export async function fetchHandleDataFromAPI(
  http: HttpManager,
  handle: BilibiliVideoHandle
): Promise<BilibiliVideoInfo> {
  return videoFetchInfo(http, handle);
}

/**
 * 获取并归一化动态数据。
 *
 * `/opus/` 链接优先走 opus 专用接口（含标题与完整正文段落），
 * 拿不到内容时回落到通用动态接口。
 */
export async function fetchDynamicFromAPI(
  http: HttpManager,
  handle: BilibiliDynamicHandle
): Promise<BilibiliDynamic> {
  if (handle.type === 'opus') {
    const opus = await opusFetchDetail(http, handle.id);
    const normalized = opus ? normalizeOpusItem(opus, handle.id) : null;
    // opus 接口对非图文动态会返回空 item，此时回落到通用接口
    if (normalized && (normalized.text || normalized.images.length)) {
      return normalized;
    }
  }

  return normalizeDynamicItem(
    await dynamicFetchDetail(http, handle.id),
    handle.type
  );
}

/* -------------------------------------------------------------------------- */
/* 归一化                                                                      */
/* -------------------------------------------------------------------------- */

const EMPTY_AUTHOR: BilibiliDynamicAuthor = { mid: 0, name: '', face: '' };

/** 将秒级时间戳（可能为字符串）转换为毫秒 */
function toMillis(ts?: number | string): number {
  const seconds = Number(ts);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

function toStat(stat?: BilibiliDynamicModuleStat | null): BilibiliDynamicStat {
  return {
    like: stat?.like?.count ?? 0,
    comment: stat?.comment?.count ?? 0,
    forward: stat?.forward?.count ?? 0,
  };
}

/** 富文本节点拼接为纯文本 */
export function richTextToPlain(nodes?: RichTextNode[]): string {
  if (!nodes?.length) return '';
  return nodes.map((node) => node.text ?? node.orig_text ?? '').join('');
}

function toImage(pic: BilibiliOpusPic): BilibiliDynamicImage {
  return { url: pic.url, width: pic.width, height: pic.height, size: pic.size };
}

/** 归一化通用动态 (desktop/v1/detail) */
export function normalizeDynamicItem(
  item: BilibiliDynamicItem,
  kind: BilibiliDynamicKind = 't'
): BilibiliDynamic {
  const modules: BilibiliDynamicModule[] = Array.isArray(item.modules)
    ? item.modules
    : [];

  const authorModule = modules.find((m) => m.module_author)?.module_author;
  const descModule = modules.find((m) => m.module_desc)?.module_desc;
  const dynamicModule = modules.find((m) => m.module_dynamic)?.module_dynamic;
  const statModule = modules.find((m) => m.module_stat)?.module_stat;

  const user = authorModule?.user;
  const result: BilibiliDynamic = {
    id: item.id_str,
    kind,
    dynamicType: item.type,
    author: user
      ? { mid: user.mid, name: user.name, face: user.face }
      : { ...EMPTY_AUTHOR },
    publishAt: toMillis(authorModule?.pub_ts),
    text: descModule?.text ?? richTextToPlain(descModule?.rich_text_nodes),
    images: [],
    stat: toStat(statModule),
  };

  const draw = dynamicModule?.dyn_draw;
  if (draw?.items?.length) {
    result.images = draw.items.map((pic) => ({
      url: pic.src,
      width: pic.width,
      height: pic.height,
      size: pic.size,
    }));
  }

  const archive = dynamicModule?.dyn_archive;
  if (archive) {
    const video: BilibiliDynamicVideo = {
      bvid: archive.bvid,
      aid: archive.aid ? Number(archive.aid) : undefined,
      cover: archive.cover,
      title: archive.title,
      desc: archive.desc,
      durationText: archive.duration_text,
      playText: archive.stat?.play,
      danmakuText: archive.stat?.danmaku,
    };
    result.video = video;
  }

  const article = dynamicModule?.dyn_article;
  if (article) {
    result.title = article.title || result.title;
    if (!result.text && article.desc) result.text = article.desc;
    if (article.covers?.length) {
      result.images = article.covers.map((url) => ({ url }));
    }
  }

  const origin = dynamicModule?.dyn_forward?.item;
  if (origin) {
    result.origin = normalizeDynamicItem(origin, 't');
  }

  return result;
}

/** 归一化图文动态 (v1/opus/detail) */
export function normalizeOpusItem(
  item: BilibiliOpusItem,
  fallbackId?: string
): BilibiliDynamic {
  const modules: BilibiliOpusModule[] = Array.isArray(item.modules)
    ? item.modules
    : [];

  const authorModule = modules.find((m) => m.module_author)?.module_author;
  const titleModule = modules.find((m) => m.module_title)?.module_title;
  const contentModule = modules.find((m) => m.module_content)?.module_content;
  const topModule = modules.find((m) => m.module_top)?.module_top;
  const statModule = modules.find((m) => m.module_stat)?.module_stat;

  const texts: string[] = [];
  const images: BilibiliDynamicImage[] = [];

  // 封面图集
  topModule?.display?.album?.pics?.forEach((pic) => images.push(toImage(pic)));

  for (const para of contentModule?.paragraphs ?? []) {
    if (para.para_type === 2) {
      para.pic?.pics?.forEach((pic) => images.push(toImage(pic)));
      continue;
    }
    for (const node of para.text?.nodes ?? []) {
      if (node.type === 'TEXT_NODE_TYPE_WORD' && node.word?.words) {
        texts.push(node.word.words);
      } else if (node.type === 'TEXT_NODE_TYPE_RICH' && node.rich) {
        // 网页节点的 text 只是 “网页链接” 这类占位文案，原文才是真正的 URL
        const isWeb = node.rich.type === 'RICH_TEXT_NODE_TYPE_WEB';
        const words = (isWeb ? node.rich.orig_text : node.rich.text) || node.rich.text;
        if (words) texts.push(words);
      }
    }
  }

  return {
    id: item.id_str || fallbackId || '',
    kind: 'opus',
    dynamicType: 'DYNAMIC_TYPE_DRAW',
    author: authorModule
      ? {
          mid: authorModule.mid,
          name: authorModule.name,
          face: authorModule.face,
        }
      : { ...EMPTY_AUTHOR },
    publishAt: toMillis(authorModule?.pub_ts),
    title: titleModule?.text || undefined,
    text: texts.join(''),
    images,
    stat: toStat(statModule),
  };
}

/* -------------------------------------------------------------------------- */
/* 凭据                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 从缓存中获取有效的 BiliTicket，如果没有了，则重新拿新的
 */
export async function getValidBilibiliTicket(ctx: AdapterContext): Promise<string> {
  const cacheField = 'bilibili:ticket';
  const cacheTicket = await ctx.helper.cacheGet(cacheField);
  if (cacheTicket) return cacheTicket;

  const ticketResp = await fetchBiliTicket();

  if (!ticketResp || ticketResp.code !== 0) return '';

  const { ticket, ttl } = ticketResp.data;
  await ctx.helper.cacheSet(cacheField, ticket, dayjs().add(ttl, 'ms').toDate());

  return ticket;
}

/** buvid 无明确有效期，缓存 7 天 */
const BUVID_CACHE_DAYS = 7;

/**
 * 从缓存中获取有效的 buvid，如果没有了，则重新拿新的。
 *
 * 动态接口缺少 `buvid3` 会直接被上游风控 (-352)。
 */
export async function getValidBilibiliBuvid(
  ctx: AdapterContext
): Promise<{ buvid3: string; buvid4: string }> {
  const cacheField = 'bilibili:buvid';
  const cached = await ctx.helper.cacheGet(cacheField);
  if (cached) {
    const [buvid3 = '', buvid4 = ''] = cached.split('|');
    if (buvid3) return { buvid3, buvid4 };
  }

  const buvidResp = await fetchBiliBuvid();
  if (!buvidResp || buvidResp.code !== 0) return { buvid3: '', buvid4: '' };

  const { b_3: buvid3, b_4: buvid4 } = buvidResp.data;
  await ctx.helper.cacheSet(
    cacheField,
    `${buvid3}|${buvid4}`,
    dayjs().add(BUVID_CACHE_DAYS, 'day').toDate()
  );

  return { buvid3, buvid4 };
}

/** 一次性取齐访问 B 站 Web 接口所需的凭据 */
export async function getValidBilibiliCredentials(
  ctx: AdapterContext
): Promise<BilibiliCredentials> {
  const [ticket, { buvid3, buvid4 }] = await Promise.all([
    getValidBilibiliTicket(ctx),
    getValidBilibiliBuvid(ctx),
  ]);
  return { ticket, buvid3, buvid4 };
}

/** 将凭据拼装为 Cookie 头 */
export function buildCredentialCookie(credentials: BilibiliCredentials): string {
  return [
    credentials.ticket && `bili_ticket=${credentials.ticket}`,
    credentials.buvid3 && `buvid3=${credentials.buvid3}`,
    credentials.buvid4 && `buvid4=${credentials.buvid4}`,
  ]
    .filter(Boolean)
    .join('; ');
}
