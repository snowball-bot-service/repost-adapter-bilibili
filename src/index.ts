import type {
  Adapter,
  AdapterContext,
  AdapterProcessRequestParams,
  AdapterProcessResponsePayload,
  AdapterRepostRequestParams,
  AdapterRepostResponsePayload,
  SocialProvider,
} from '@snowball-bot/repost-adapter';
import { BilibiliVideoHandle, extractHandleId, fetchHandleDataFromAPI, getValidBilibiliTicket } from './manager';
import type { RepostExtraParams } from './type';
import { FetchHandleDataFailedException, UnsupportedProcessException } from './utils/error';
import { HttpManager } from './utils/http';
import { fetchBiliTicket, videoFetchDownloadInfo, videoFetchSnapshot } from './utils/bilibili-api';
import { bilibiliFetchVideoDetailV2 } from './utils/justone-api';

export { HttpError, HttpManager } from './utils/http';
export type {
  HttpManagerOptions,
  HttpMethod,
  HttpRequestOptions,
  QueryParams,
} from './utils/http';
export type {
  BilibiliVideoInfo,
  BilibiliVideoInfoPayload,
} from './bilibili/video.type';
export type { BilibiliDynamicDetailPayload } from './bilibili/dynamic.type';

const CONST = {
  provider: 'bilibili' as SocialProvider,
  apiBaseURL: 'https://api.bilibili.com',
  apiTimeout: 10_000,
  apiRetries: 1,
};

let http: HttpManager | null = null;

/**
 * 纯净 HTTP 客户端，无任何 inject
 */
let pureHttp: HttpManager = new HttpManager({
  baseUrl: "",
  timeoutMs: 10000,
  retries: 1,
});

const adapter: Adapter = {
  manifest: {
    name: 'repost-adapter-bilibili',
    provider: CONST.provider,
    whitelistHosts: ['bilibili.com', 'b23.tv'],
    version: 1,
    author: 'Rominwolf',
    billing: { text: 100, token: 100, media: 1000, green: 1 },
    providerInfo: {
      name: '哔哩哔哩',
      icon: '📺',
      color: '#FFFFFF',
      bgColor: '#00AEEC',
    },
  },

  async initState(ctx: AdapterContext) {
    const baseURL = ctx.config<string>("baseURL");
    const timeout = ctx.config<number>("timeout");
    const headers = ctx.config<Record<string, string>>("headers");

    http = new HttpManager({
      baseUrl: baseURL || CONST.apiBaseURL,
      timeoutMs: timeout || CONST.apiTimeout,
      retries: CONST.apiRetries,
      headers: {
        ...headers,
        bili_ticket: await getValidBilibiliTicket(ctx),
      },
      logger: ctx.logger,
    });

    ctx.logger.info("BILI TICKET", await getValidBilibiliTicket(ctx));

    ctx.on('onRepostRequest', (req) => handleRepostRequest(req, ctx));
    ctx.on('onProcessRequest', (req) => handleProcessingRequest(req, ctx, {}));
    ctx.logger.info(`[${CONST.provider}] Adapter initialized`);
  },

  dispose() {
    http?.dispose();
    http = null;
  },
};

async function handleRepostRequest(
  req: AdapterRepostRequestParams,
  ctx: AdapterContext
): Promise<AdapterRepostResponsePayload<RepostExtraParams>> {
  if (!http) throw new Error('Bilibili adapter has not been initialized');
  ctx.logger.debug(`[${CONST.provider}] fetching ${req.source}`);

  const handle = await extractHandleId(pureHttp, req.source);

  if (handle.type === "video") return continueHandleVideoRequest(req, ctx, handle);

  throw new FetchHandleDataFailedException(handle.method, handle.id, "Unsupported Type");
}

async function _flowFetchSnapshotBuffer(
  ctx: AdapterContext,
  handle: BilibiliVideoHandle,
  duration: number,
) {
  const {
    image: snapshotImagesUrl,
    img_x_size: imgXSize, img_y_size: imgYSize,
    img_x_len: imgXLen, img_y_len: imgYLen,
  } = await videoFetchSnapshot(http!, handle.query);

  // url 拿到的是不含协议的裸 URI，eg. //bimp.hdslb.com/videoshotpvhdboss/39789659369_ku8x3b-0001.jpg
  const snapshotRawResp = await pureHttp.request("GET", `https:${snapshotImagesUrl[0]}`);
  const snapshotRawArrayBuffer = await snapshotRawResp.bytes();
  const snapshotRawBuffer = Buffer.from(snapshotRawArrayBuffer);

  ctx.logger.debug("RAW BUFFER", snapshotRawBuffer);

  const frames = await ctx.helper.spriteToFrames("buffer", snapshotRawBuffer, {
    imgLenX: imgXLen, imgLenY: imgYLen,
    imgSizeX: imgXSize, imgSizeY: imgYSize,
    duration: duration,
  });

  const gifBuffer = await ctx.helper.convertFramesToGIF({
    frames: frames, frameRate: 1,
  });

  return gifBuffer ?? undefined;
  // return undefined;
}

async function continueHandleVideoRequest(
  req: AdapterRepostRequestParams,
  ctx: AdapterContext,
  handle: BilibiliVideoHandle,
): Promise<AdapterRepostResponsePayload<RepostExtraParams>> {
  if (!http) throw new Error('Bilibili adapter has not been initialized');

  const justOneApiToken = ctx.config<string>("justOneApiToken");
  if (!justOneApiToken) throw new Error('JustOneApi has not been initialized');

  if (!handle.query.bvid) throw new Error('BVid can not be empty');

  // const video = await bilibiliFetchVideoDetailV2(justOneApiToken, handle.query.bvid);

  const video = await fetchHandleDataFromAPI(http, handle);

  const category = [video.tname, video.tname_v2]
    .filter(
      (value, index, array) => Boolean(value) && array.indexOf(value) === index
    )
    .join(' · ');

  const gifBuffer = await _flowFetchSnapshotBuffer(ctx, handle, video.duration);

  return {
    method: 'post',
    provider: CONST.provider,
    code: req.code,
    originalUrl: req.source,
    requester: req.requester,
    postId: video.bvid || handle.id,
    publishAt: new Date(video.pubdate * 1000),
    author: {
      userId: String(video.owner.mid),
      nickname: video.owner.name,
      headshotUrl: video.owner.face,
    },
    title: video.title,
    content: video.desc,
    cover: video.pic,
    overlayCoverBuffer: gifBuffer,
    badges: [
      [
        {
          emoji: '👀',
          name: ctx.helper.extraHumanable('播放', video.stat.view, '次'),
        },
        { emoji: '⏱️', name: "时长 " + ctx.helper.humanableDuration(video.duration) },
        ...(category ? [{ emoji: '🏷️', name: category }] : []),
      ],
      [
        {
          emoji: '👍',
          name: ctx.helper.extraHumanable('点赞', video.stat.like, '次'),
        },
        {
          emoji: '🪙',
          name: ctx.helper.extraHumanable('投币', video.stat.coin, '枚'),
        },
        {
          emoji: '⭐',
          name: ctx.helper.extraHumanable('收藏', video.stat.favorite, '次'),
        },
      ],
    ],
    strawberry: {
      emoji: "🎞",
      feature: "原始视频",
    },
    extra: { bvid: video.bvid, aid: video.aid, cid: video.cid, type: "video" },
  };
}

async function handleProcessingRequest(
  req: AdapterProcessRequestParams,
  ctx: AdapterContext,
  _options: object
): Promise<AdapterProcessResponsePayload | null> {
  const { logger } = ctx;
  const { method, source, requester, code, repostMethod, extra: _extra } = req;
  const { bvid, aid, cid, type } = _extra as RepostExtraParams;

  logger.debug(`[${CONST.provider}] fetching ${method}: ${source}`);

  // 获取原视频: 获取 Bilibili Video 原始视频
  if (method === 'strawberry' && repostMethod === 'post' && type === "video") {
    const downloadInfo = await videoFetchDownloadInfo(http!, {
      aid, bvid, cid,
      platform: "html5", qn: 6,
    });

    logger.debug("PROCESS RESPONSE DATA", JSON.stringify(downloadInfo));

    const url = downloadInfo?.durl[0]?.url;
    if (!url) {
      throw new FetchHandleDataFailedException(
        'post',
        source,
        '获取视频播放链接失败'
      );
    }

    return {
      method,
      requester,
      code,
      provider: CONST.provider,
      medias: [
        { type: "video", url: url },
      ],
    };
  }

  // 抛出不支持的进程
  throw new UnsupportedProcessException(method, source);
}

export default adapter;
