import type { AdapterContext, RepostMethod } from '@snowball-bot/repost-adapter';
import type {
  BilibiliVideoInfo,
  BilibiliVideoInfoPayload,
} from './bilibili/video.type';
import {
  FetchHandleDataFailedException,
  UnsupportedMethodException,
} from './utils/error';
import { HttpManager } from './utils/http';
import { fetchBiliTicket, videoFetchInfo } from './utils/bilibili-api';
import dayjs from 'dayjs';

export interface BilibiliVideoHandle {
  method: 'post';
  type: "video" | "opus";
  id: string;
  query: { bvid?: string; aid?: number };
}

const BILIBILI_HOSTS = new Set([
  'bilibili.com',
  'www.bilibili.com',
  'm.bilibili.com',
]);
const SHORT_HOSTS = new Set(['b23.tv', 'www.b23.tv']);

/** 解析 B 站视频链接；短链会跟随重定向后再解析。 */
export async function extractHandleId(
  http: HttpManager,
  source: string
): Promise<BilibiliVideoHandle> {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new UnsupportedMethodException(undefined, source);
  }

  if (SHORT_HOSTS.has(url.hostname.toLowerCase())) {
    const response = await http.get(url.toString(), { retries: 0 });
    if (!response.url) throw new UnsupportedMethodException(undefined, source);
    return extractHandleId(http, response.url);
  }
  if (!BILIBILI_HOSTS.has(url.hostname.toLowerCase())) {
    throw new UnsupportedMethodException(undefined, source);
  }

  const match = /^\/video\/(BV[\w]+|av\d+)(?:\/|$)/i.exec(url.pathname);
  if (!match) throw new UnsupportedMethodException(undefined, source);
  const id = match[1];

  return {
    method: 'post',
    type: "video",
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
 * 从 Redis 中获取有效的 BiliTicker，如果没有了，则重新拿新的
 */
export async function getValidBilibiliTicket(ctx: AdapterContext): Promise<string> {
  const cacheField = "bilibili:ticket";
  const cacheTicket = await ctx.helper.cacheGet(cacheField);
  if (cacheTicket) return cacheTicket;

  const ticketResp = await fetchBiliTicket();

  if (!ticketResp || ticketResp.code !== 0) return "";

  const { ticket, ttl } = ticketResp.data;
  await ctx.helper.cacheSet(cacheField, ticket, dayjs().add(ttl, "ms").toDate());

  return ticket;
}
