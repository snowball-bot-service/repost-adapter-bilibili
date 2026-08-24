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
import { BiliTicketResponse } from '../bilibili/security.type';

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
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0'
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}
