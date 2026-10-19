import type {
  Adapter,
  AdapterContext,
  AdapterProcessRequestParams,
  AdapterProcessResponsePayload,
  AdapterRepostRequestParams,
  AdapterRepostResponsePayload,
  BaseRepostAdapterResponsePayload,
  RepostBadgeParams,
  SocialProvider,
} from '@snowball-bot/repost-adapter';
import {
  BilibiliDynamicHandle,
  BilibiliVideoHandle,
  buildCredentialCookie,
  extractHandleId,
  fetchDynamicFromAPI,
  fetchHandleDataFromAPI,
  getValidBilibiliCredentials,
} from './manager';
import type { RepostExtraParams } from './type';
import type { BilibiliDynamic } from './bilibili/dynamic.type';
import { FetchHandleDataFailedException, UnsupportedProcessException } from './utils/error';
import { HttpManager } from './utils/http';
import {
  BILIBILI_WEB_USER_AGENT,
  videoFetchDownloadInfo,
  videoFetchInfo,
  videoFetchSnapshot,
} from './utils/bilibili-api';

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
export type {
  BilibiliDynamic,
  BilibiliDynamicDetailPayload,
  BilibiliDynamicImage,
  BilibiliDynamicItem,
  BilibiliDynamicKind,
  BilibiliDynamicVideo,
  BilibiliOpusDetailPayload,
  BilibiliOpusItem,
} from './bilibili/dynamic.type';

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
    whitelistHosts: ['bilibili.com', 't.bilibili.com', 'b23.tv'],
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

    // 动态接口要求携带 buvid3 Cookie，否则上游直接返回 -352 风控
    const credentials = await getValidBilibiliCredentials(ctx);

    http = new HttpManager({
      baseUrl: baseURL || CONST.apiBaseURL,
      timeoutMs: timeout || CONST.apiTimeout,
      retries: CONST.apiRetries,
      headers: {
        'User-Agent': BILIBILI_WEB_USER_AGENT,
        ...headers,
        cookie: buildCredentialCookie(credentials),
      },
      logger: ctx.logger,
    });

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
  if (handle.type === "opus" || handle.type === "t") {
    return continueHandleDynamicRequest(req, ctx, handle);
  }

  throw new FetchHandleDataFailedException(handle.method, handle.id, "Unsupported Type");
}

async function _flowFetchSnapshotBuffer(
  ctx: AdapterContext,
  handle: BilibiliVideoHandle,
  duration: number,
) {
  const now = Date.now();
  ctx.logger.info("NOW", now);

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

  ctx.logger.info("RAW BUFFER", Date.now() - now);

  const frames = await ctx.helper.spriteToFrames("buffer", snapshotRawBuffer, {
    imgLenX: imgXLen, imgLenY: imgYLen,
    imgSizeX: imgXSize, imgSizeY: imgYSize,
    duration: duration,
  });

  ctx.logger.info("frames", Date.now() - now);

  const gifBuffer = await ctx.helper.convertFramesToGIF({
    frames: frames, frameRate: 1,
  });

  ctx.logger.info("gifBuffer", Date.now() - now);

  return gifBuffer ?? undefined;
  // return undefined;
}

async function continueHandleVideoRequest(
  req: AdapterRepostRequestParams,
  ctx: AdapterContext,
  handle: BilibiliVideoHandle,
): Promise<AdapterRepostResponsePayload<RepostExtraParams>> {
  if (!http) throw new Error('Bilibili adapter has not been initialized');

  if (!handle.query.bvid) throw new Error('BVid can not be empty');

  const video = await fetchHandleDataFromAPI(http, handle);

  const category = [video.tname, video.tname_v2]
    .filter(
      (value, index, array) => Boolean(value) && array.indexOf(value) === index
    )
    .join(' · ');

  const gifBuffer = await _flowFetchSnapshotBuffer(ctx, handle, Math.min(120, video.duration));

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

/* -------------------------------------------------------------------------- */
/* 动态                                                                        */
/* -------------------------------------------------------------------------- */

/** 动态互动数据徽章；源动态拿不到互动数据时整行省略 */
function buildDynamicStatBadges(
  ctx: AdapterContext,
  dynamic: BilibiliDynamic
): RepostBadgeParams[] | null {
  const { like, comment, forward } = dynamic.stat;
  if (!like && !comment && !forward) return null;

  return [
    { emoji: '👍', name: ctx.helper.extraHumanable('点赞', like, '次') },
    { emoji: '💬', name: ctx.helper.extraHumanable('评论', comment, '条') },
    { emoji: '🔁', name: ctx.helper.extraHumanable('转发', forward, '次') },
  ];
}

/** 动态内容数据徽章（图片数量 / 内嵌视频信息） */
function buildDynamicMediaBadges(
  ctx: AdapterContext,
  dynamic: BilibiliDynamic
): RepostBadgeParams[] | null {
  const badges: RepostBadgeParams[] = [];

  if (dynamic.images.length) {
    badges.push({
      emoji: '🖼️',
      name: ctx.helper.extraHumanable('图片', dynamic.images.length, '张'),
    });
  }

  const { video } = dynamic;
  if (video?.durationText) {
    badges.push({ emoji: '⏱️', name: `时长 ${video.durationText}` });
  }
  if (video?.playText) {
    badges.push({ emoji: '👀', name: `播放 ${video.playText}` });
  }

  return badges.length ? badges : null;
}

function buildDynamicBadges(
  ctx: AdapterContext,
  dynamic: BilibiliDynamic
): RepostBadgeParams[][] {
  return [
    buildDynamicMediaBadges(ctx, dynamic),
    buildDynamicStatBadges(ctx, dynamic),
  ].filter((row): row is RepostBadgeParams[] => Boolean(row));
}

/** 将归一化动态投影为（子集）卡片负载 */
function buildDynamicCard(
  ctx: AdapterContext,
  dynamic: BilibiliDynamic
): BaseRepostAdapterResponsePayload {
  const { video } = dynamic;

  return {
    method: 'post',
    postId: dynamic.id,
    ...(dynamic.publishAt ? { publishAt: new Date(dynamic.publishAt) } : {}),
    author: {
      userId: String(dynamic.author.mid),
      nickname: dynamic.author.name,
      headshotUrl: dynamic.author.face,
    },
    title: dynamic.title || video?.title,
    // 内嵌视频的动态：正文为空时用视频简介兜底
    content: dynamic.text || video?.desc || '',
    cover: video?.cover,
    images: dynamic.images.length
      ? dynamic.images.map((image) => image.url)
      : undefined,
    badges: buildDynamicBadges(ctx, dynamic),
  };
}

/** 取动态自身或其源动态中的内嵌视频 */
function pickDynamicVideo(dynamic: BilibiliDynamic) {
  return dynamic.video ?? dynamic.origin?.video;
}

async function continueHandleDynamicRequest(
  req: AdapterRepostRequestParams,
  ctx: AdapterContext,
  handle: BilibiliDynamicHandle,
): Promise<AdapterRepostResponsePayload<RepostExtraParams>> {
  if (!http) throw new Error('Bilibili adapter has not been initialized');

  const dynamic = await fetchDynamicFromAPI(http, handle);
  const card = buildDynamicCard(ctx, dynamic);
  const video = pickDynamicVideo(dynamic);

  return {
    ...card,
    provider: CONST.provider,
    code: req.code,
    originalUrl: req.source,
    requester: req.requester,
    postId: dynamic.id || handle.id,
    // 转发动态：源动态作为子集展示
    child: dynamic.origin ? buildDynamicCard(ctx, dynamic.origin) : undefined,
    ...(video?.bvid
      ? { strawberry: { emoji: '🎞', feature: '原始视频' } }
      : {}),
    extra: {
      type: handle.type,
      dynamicId: dynamic.id || handle.id,
      bvid: video?.bvid,
      aid: video?.aid,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* 进程                                                                        */
/* -------------------------------------------------------------------------- */

async function handleProcessingRequest(
  req: AdapterProcessRequestParams,
  ctx: AdapterContext,
  _options: object
): Promise<AdapterProcessResponsePayload | null> {
  const { logger } = ctx;
  const { method, source, requester, code, repostMethod, extra: _extra } = req;
  const { bvid, aid, cid } = (_extra ?? {}) as RepostExtraParams;

  logger.debug(`[${CONST.provider}] fetching ${method}: ${source}`);

  // 获取原视频: 视频稿件，以及内嵌视频的动态
  if (method === 'strawberry' && repostMethod === 'post' && bvid) {
    // 动态内嵌视频不带 cid，按 bvid 补齐
    const videoCid =
      cid ??
      (
        await videoFetchInfo(http!, {
          method: 'post',
          type: 'video',
          id: bvid,
          query: { bvid },
        })
      ).cid;

    const downloadInfo = await videoFetchDownloadInfo(http!, {
      aid, bvid, cid: videoCid,
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
