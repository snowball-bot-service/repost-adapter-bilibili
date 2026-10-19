import { HttpManager } from './http';
import type {
  BilibiliVideoInfo,
  BilibiliVideoInfoPayload,
  BilibiliVideoSnapshotPayload,
  VideoDownloadInfoPayload,
  VideoDownloadParams,
  VideoSnapshotParams,
} from '../bilibili/video.type';
import {
  FetchHandleDataFailedException,
  FetchVideoDownloadInfoFailedException,
  FetchVideoSnapshotFailedException,
} from './error';
import type { RepostMethod } from '@snowball-bot/repost-adapter';
import { BilibiliVideoHandle } from '../manager';
import * as crypto from 'crypto';
import { BiliBuvidResponse, BiliTicketResponse } from '../bilibili/security.type';
import type {
  BilibiliDynamicDetailPayload,
  BilibiliDynamicItem,
  BilibiliOpusDetailPayload,
  BilibiliOpusItem,
} from '../bilibili/dynamic.type';
import { FetchDynamicDetailFailedException } from './error';

/** 访问 B 站 Web 接口统一使用的 UA；缺失时部分接口会直接风控。 */
export const BILIBILI_WEB_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** 获取公开视频详情，并将业务错误转换为适配器错误。 */
export async function videoFetchInfo(
  http: HttpManager,
  handle: BilibiliVideoHandle
): Promise<BilibiliVideoInfo> {
  const payload = await http.getJson<BilibiliVideoInfoPayload>(
    '/x/web-interface/wbi/view',
    {
      query: handle.query,
    }
  );
  if (payload.code !== 0 || !payload.data) {
    throw new FetchHandleDataFailedException(
      handle.method as RepostMethod,
      handle.id,
      payload.message || `Bilibili API returned code ${payload.code}`
    );
  }
  return payload.data;
}

/**
 * 获取视频的快照信息
 * @param http
 * @param params
 */
export async function videoFetchSnapshot(
  http: HttpManager,
  params: VideoSnapshotParams
): Promise<BilibiliVideoSnapshotPayload['data']> {
  const payload = await http.getJson<BilibiliVideoSnapshotPayload>(
    '/x/player/videoshot',
    {
      query: { ...params },
    }
  );

  if (payload.code !== 0 || !payload.data) {
    throw new FetchVideoSnapshotFailedException(
      String(params.bvid),
      payload.message || `Bilibili API returned code ${payload.code}`
    );
  }

  return payload.data;
}

/**
 * 获取视频的下载信息
 * @param http
 * @param params
 */
export async function videoFetchDownloadInfo(
  http: HttpManager,
  params: VideoDownloadParams
): Promise<VideoDownloadInfoPayload['data']> {
  const referer = `https://www.bilibili.com/video/${params.bvid || params.aid}/`;

  const payload = await http.getJson<VideoDownloadInfoPayload>(
    '/x/player/playurl',
    {
      query: { ...params },
      headers: {
        referer,
      },
    }
  );

  if (payload.code !== 0 || !payload.data) {
    throw new FetchVideoDownloadInfoFailedException(
      String(params.bvid),
      payload.message || `Bilibili API returned code ${payload.code}`
    );
  }

  return payload.data;
}

/**
 * Generate HMAC-SHA256 signature
 * @param {string} key     The key string to use for the HMAC-SHA256 hash
 * @param {string} message The message string to hash
 * @returns {string} The HMAC-SHA256 signature as a hex string
 */
function hmacSha256(key: string, message: string) {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * Get Bilibili web ticket
 * @param {string} csrf    CSRF token, can be empty or null
 * @returns {Promise<any>} Promise of the ticket response in JSON format
 */
export async function fetchBiliTicket(csrf?: string): Promise<BiliTicketResponse> {
  const ts = Math.floor(Date.now() / 1000);
  const hexSign = hmacSha256('XgwSnGZ1p', `ts${ts}`);
  const url = 'https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket';
  const params = new URLSearchParams({
    "key_id": 'ec02',
    "hexsign": hexSign,
    "context[ts]": String(ts),
    "csrf": csrf || ''
  });
  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'User-Agent': BILIBILI_WEB_USER_AGENT
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取 Web 端设备指纹 (buvid)
 *
 * 动态接口必须携带 `buvid3` Cookie，否则上游返回 -352 风控错误。
 */
export async function fetchBiliBuvid(): Promise<BiliBuvidResponse> {
  const response = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
    headers: {
      'User-Agent': BILIBILI_WEB_USER_AGENT,
      referer: 'https://www.bilibili.com/',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * 获取通用动态详情（opus / t 均可命中）
 *
 * 使用 desktop 版接口：相比 `/x/polymer/web-dynamic/v1/detail`，它不需要 wbi 签名，
 * 且 opus / t / 转发动态返回同一套 module 结构。
 *
 * @param http
 * @param id 动态 ID
 */
export async function dynamicFetchDetail(
  http: HttpManager,
  id: string
): Promise<BilibiliDynamicItem> {
  const payload = await http.getJson<BilibiliDynamicDetailPayload>(
    '/x/polymer/web-dynamic/desktop/v1/detail',
    {
      query: { id, timezone_offset: -480, platform: 'web', features: 'itemOpusStyle' },
      headers: { referer: `https://t.bilibili.com/${id}` },
    }
  );

  if (payload.code !== 0 || !payload.data?.item) {
    throw new FetchDynamicDetailFailedException(
      id,
      payload.message || `Bilibili API returned code ${payload.code}`
    );
  }

  return payload.data.item;
}

/**
 * 获取图文动态 (opus) 详情
 *
 * 相比通用动态接口，它额外提供标题与完整的正文段落（文本 + 图片），
 * 因此 `/opus/` 链接优先走这里。
 *
 * @param http
 * @param id 动态 ID
 * @return 命中返回 item；上游明确表示该 ID 不是 opus（data.item 缺失）时返回 null
 */
export async function opusFetchDetail(
  http: HttpManager,
  id: string
): Promise<BilibiliOpusItem | null> {
  const payload = await http.getJson<BilibiliOpusDetailPayload>(
    '/x/polymer/web-dynamic/v1/opus/detail',
    {
      query: { id },
      headers: { referer: `https://www.bilibili.com/opus/${id}` },
    }
  );

  if (payload.code !== 0) {
    throw new FetchDynamicDetailFailedException(
      id,
      payload.message || `Bilibili API returned code ${payload.code}`
    );
  }

  return payload.data?.item ?? null;
}
