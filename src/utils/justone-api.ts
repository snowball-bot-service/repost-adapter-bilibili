import { HttpManager } from './http';
import type { BilibiliVideoInfo, BilibiliVideoInfoPayload } from '../bilibili/video.type';
import { FetchHandleDataFailedException } from './error';
import type { ILogger, RepostMethod } from '@snowball-bot/repost-adapter';
import { getValidBilibiliTicket } from '../manager';

export interface JustOneApiRootResponse<T> {
  code: 0 | number;
  data: T;
  message: string | null;
  recordTime: number | null;
}

export const http = new HttpManager({
  baseUrl: "https://api.justoneapi.com",
  timeoutMs: 15000,
  retries: 1,
});

/**
 * JustOne API · 获取 Bilibili 视频信息 V2
 * @param http
 * @param token
 * @param bvid
 */
export async function bilibiliFetchVideoDetailV2(
  token: string,
  bvid: string,
): Promise<BilibiliVideoInfo> {
  const payload = await http.getJson<JustOneApiRootResponse<never>>(
    '/api/bilibili/get-video-detail/v2',
    {
      query: {
        token, bvid,
      },
    }
  );

  if (payload.code !== 0 || !payload.data) {
    throw new FetchHandleDataFailedException(
      "post",
      bvid,
      payload.message || `Upstream API returned code ${payload.code}`
    );
  }
  return payload.data["videoData"];
}
