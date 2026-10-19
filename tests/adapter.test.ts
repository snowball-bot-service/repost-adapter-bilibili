import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AdapterContext,
  ProcessHandler,
  RepostHandler,
} from '@snowball-bot/repost-adapter';
import adapter from '../src';

const videoPayload = {
  code: 0,
  message: '0',
  ttl: 1,
  data: {
    bvid: 'BV1xx411c7mD',
    aid: 170001,
    cid: 123,
    pic: 'https://i0.hdslb.com/cover.jpg',
    title: '测试视频',
    pubdate: 1_700_000_000,
    desc: '视频简介',
    duration: 125,
    tname: '动画',
    tname_v2: 'MAD·AMV',
    owner: { mid: 42, name: '测试 UP', face: 'https://i0.hdslb.com/face.jpg' },
    stat: { view: 12_345, like: 678, coin: 90, favorite: 12 },
  },
};

/** `/x/polymer/web-dynamic/v1/opus/detail` —— 图文动态（两张图 + 正文 + 网页节点） */
const opusPayload = {
  code: 0,
  message: '0',
  ttl: 1,
  data: {
    item: {
      id_str: '1260561412356308994',
      type: 0,
      basic: { title: 'TonyHSQ的动态', uid: '341562854' },
      modules: [
        {
          module_type: 'MODULE_TYPE_AUTHOR',
          module_author: {
            mid: 341562854,
            name: 'TonyHSQ',
            face: 'https://i2.hdslb.com/face.jpg',
            pub_ts: '1792335725',
          },
        },
        {
          module_type: 'MODULE_TYPE_CONTENT',
          module_content: {
            paragraphs: [
              {
                para_type: 1,
                text: {
                  nodes: [
                    { type: 'TEXT_NODE_TYPE_WORD', word: { words: '终于完结了' } },
                    {
                      type: 'TEXT_NODE_TYPE_RICH',
                      rich: {
                        text: '网页链接',
                        orig_text: 'https://b23.tv/MV897G7',
                        type: 'RICH_TEXT_NODE_TYPE_WEB',
                      },
                    },
                  ],
                },
              },
              {
                para_type: 2,
                pic: {
                  pics: [
                    { url: 'https://i0.hdslb.com/dyn/1.jpg', width: 1500, height: 2121, size: 926 },
                    { url: 'https://i0.hdslb.com/dyn/2.jpg', width: 1440, height: 3136, size: 593 },
                  ],
                },
              },
            ],
          },
        },
        {
          module_type: 'MODULE_TYPE_STAT',
          module_stat: {
            like: { count: 104 },
            comment: { count: 5 },
            forward: { count: 1 },
          },
        },
      ],
    },
  },
};

/** `/x/polymer/web-dynamic/desktop/v1/detail` —— 投稿视频动态 */
const dynamicAvPayload = {
  code: 0,
  message: '0',
  ttl: 1,
  data: {
    item: {
      id_str: '1260375384483954712',
      type: 'DYNAMIC_TYPE_AV',
      modules: [
        {
          module_type: 'MODULE_TYPE_AUTHOR',
          module_author: {
            pub_ts: 1_792_292_412,
            user: { mid: 946974, name: '影视飓风', face: 'https://i0.hdslb.com/face.jpg' },
          },
        },
        {
          module_type: 'MODULE_TYPE_DESC',
          module_desc: {
            text: '电脑算是被重新发明了吗？',
            rich_text_nodes: [
              { type: 'RICH_TEXT_NODE_TYPE_TEXT', text: '电脑算是被重新发明了吗？' },
            ],
          },
        },
        {
          module_type: 'MODULE_TYPE_DYNAMIC',
          module_dynamic: {
            type: 'MDL_DYN_TYPE_ARCHIVE',
            dyn_archive: {
              aid: '117459487103569',
              bvid: 'BV1HhnM62ER1',
              cover: 'https://i1.hdslb.com/archive.jpg',
              title: '动态视频｜RTX Spark 笔记本',
              desc: '视频简介',
              duration_text: '07:22',
              stat: { play: '107.1万', danmaku: '2069' },
            },
          },
        },
        {
          module_type: 'MODULE_TYPE_STAT',
          module_stat: {
            like: { count: 54_677 },
            comment: { count: 2857 },
            forward: { count: 268 },
          },
        },
      ],
    },
  },
};

/** `/x/polymer/web-dynamic/desktop/v1/detail` —— 转发动态（源动态带图片） */
const dynamicForwardPayload = {
  code: 0,
  message: '0',
  ttl: 1,
  data: {
    item: {
      id_str: '1260730964793884787',
      type: 'DYNAMIC_TYPE_FORWARD',
      modules: [
        {
          module_type: 'MODULE_TYPE_AUTHOR',
          module_author: {
            pub_ts: 1_792_375_202,
            user: { mid: 1937308559, name: '赛博食录', face: 'https://i2.hdslb.com/face.jpg' },
          },
        },
        {
          module_type: 'MODULE_TYPE_DESC',
          module_desc: { text: '恭喜中奖，已私信通知。' },
        },
        {
          module_type: 'MODULE_TYPE_DYNAMIC',
          module_dynamic: {
            type: 'MDL_DYN_TYPE_FORWARD',
            dyn_forward: {
              item: {
                id_str: '1259714346010804242',
                type: 'DYNAMIC_TYPE_DRAW',
                modules: [
                  {
                    module_type: 'MODULE_TYPE_AUTHOR',
                    module_author: {
                      pub_ts: 1_792_138_502,
                      user: {
                        mid: 1937308559,
                        name: '赛博食录',
                        face: 'https://i2.hdslb.com/face.jpg',
                      },
                    },
                  },
                  {
                    module_type: 'MODULE_TYPE_DESC',
                    module_desc: { text: '随机抽取了一些大闸蟹。' },
                  },
                  {
                    module_type: 'MODULE_TYPE_DYNAMIC',
                    module_dynamic: {
                      type: 'MDL_DYN_TYPE_DRAW',
                      dyn_draw: {
                        id: 412388362,
                        items: [
                          { src: 'https://i0.hdslb.com/dyn/a.png', width: 2436, height: 1826, size: 4524 },
                          { src: 'https://i0.hdslb.com/dyn/b.png', width: 1140, height: 974, size: 1539 },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        {
          module_type: 'MODULE_TYPE_STAT',
          module_stat: {
            like: { count: 286 },
            comment: { count: 1 },
            forward: { count: 0 },
          },
        },
      ],
    },
  },
};

function createMockContext(): {
  ctx: AdapterContext;
  getRepostHandler: () => RepostHandler;
  getProcessHandler: () => ProcessHandler;
} {
  let repostHandler: RepostHandler | null = null;
  let processHandler: ProcessHandler | null = null;

  // 预置凭据缓存，避免 initState 触发 ticket / buvid 的网络请求
  const cache = new Map<string, string>([
    ['bilibili:ticket', 'TICKET'],
    ['bilibili:buvid', 'BUVID3|BUVID4'],
  ]);

  const ctx = {
    on: vi.fn((event: string, handler: RepostHandler | ProcessHandler) => {
      if (event === 'onRepostRequest') repostHandler = handler as RepostHandler;
      if (event === 'onProcessRequest') processHandler = handler as ProcessHandler;
    }),
    config: vi.fn(),
    helper: {
      pick: (record: Record<string, string>, key: string, fallback?: string) =>
        record[key] ?? fallback!,
      extraHumanable: (prefix: string, value: number, suffix: string) =>
        `${prefix}${value}${suffix}`,
      humanableDuration: () => '02:05',
      cacheGet: vi.fn(async (field: string) => cache.get(field)),
      cacheSet: vi.fn(async (field: string, value: string) => {
        cache.set(field, value);
        return true;
      }),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  } as unknown as AdapterContext;

  return {
    ctx,
    getRepostHandler: () => {
      if (!repostHandler) throw new Error('Handler not registered');
      return repostHandler;
    },
    getProcessHandler: () => {
      if (!processHandler) throw new Error('Handler not registered');
      return processHandler;
    },
  };
}

function mockFetch(response: unknown) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/**
 * 按 URL 片段路由的 fetch 桩，便于一次请求链里命中多个接口。
 * 每次命中都会新建 Response，避免 body 被重复读取。
 */
function mockFetchRoutes(routes: Array<[string, unknown]>) {
  const fetch = vi.fn(async (url: string) => {
    const hit = routes.find(([fragment]) => String(url).includes(fragment));
    if (!hit) throw new Error(`Unexpected request: ${url}`);
    return new Response(JSON.stringify(hit[1]), { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const request = {
  code: 'test',
  requester: { userId: 'REQUESTER_USERID', nickname: 'REQUESTER_NICKNAME' },
};

afterEach(() => vi.unstubAllGlobals());

describe('adapter', () => {
  it('exposes Bilibili hosts in its manifest', () => {
    expect(adapter.manifest.name).toBe('repost-adapter-bilibili');
    expect(adapter.manifest.whitelistHosts).toEqual([
      'bilibili.com',
      't.bilibili.com',
      'b23.tv',
    ]);
  });

  // 既有限制：视频流程要求 BV 号，av 链接解析出 aid 后会被拒绝
  it('rejects an av link because the video flow requires a bvid', async () => {
    const fetch = mockFetch(
      new Response(JSON.stringify(videoPayload), { status: 200 })
    );
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    await expect(
      getRepostHandler()({
        ...request,
        source: 'https://bilibili.com/video/av170001',
      })
    ).rejects.toThrow('BVid can not be empty');

    expect(fetch).not.toHaveBeenCalled();
  });

  it('follows b23 redirects before resolving a handle', async () => {
    const fetch = vi.fn();
    fetch.mockResolvedValueOnce({
      ok: true,
      url: 'https://www.bilibili.com/opus/1260561412356308994',
    });
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify(opusPayload), { status: 200 })
    );
    vi.stubGlobal('fetch', fetch);

    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    const result = await getRepostHandler()({
      ...request,
      source: 'https://b23.tv/eFIda2Q',
    });

    expect(result?.postId).toBe('1260561412356308994');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown links and Bilibili business errors', async () => {
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    await expect(
      getRepostHandler()({
        ...request,
        source: 'https://www.bilibili.com/read/cv1',
      })
    ).rejects.toThrow();

    mockFetch(
      new Response(JSON.stringify({ code: -404, message: '视频不存在' }), {
        status: 200,
      })
    );
    await expect(
      getRepostHandler()({
        ...request,
        source: 'https://www.bilibili.com/video/BV1xx411c7mD',
      })
    ).rejects.toThrow('视频不存在');
  });

  it('rejects unsupported processing requests', async () => {
    const { ctx, getProcessHandler } = createMockContext();
    await adapter.initState(ctx);
    await expect(
      getProcessHandler()({
        ...request,
        method: 'watermelon',
        repostMethod: 'post',
        source: 'BV1xx411c7mD',
        extra: { type: 'video', bvid: 'BV1xx411c7mD' },
      })
    ).rejects.toThrow();
  });
});

describe('dynamic · opus', () => {
  it('maps an opus dynamic to a card with images and stats', async () => {
    const fetch = mockFetchRoutes([['/opus/detail', opusPayload]]);
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    const result = await getRepostHandler()({
      ...request,
      source: 'https://www.bilibili.com/opus/1260561412356308994?share_source=copy',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('id=1260561412356308994'),
      expect.any(Object)
    );
    expect(result).toMatchObject({
      method: 'post',
      postId: '1260561412356308994',
      author: { userId: '341562854', nickname: 'TonyHSQ' },
      extra: { type: 'opus', dynamicId: '1260561412356308994' },
    });
    // 网页节点取原文 URL，而非 “网页链接” 占位文案
    expect(result?.content).toBe('终于完结了https://b23.tv/MV897G7');
    expect(result?.images).toEqual([
      'https://i0.hdslb.com/dyn/1.jpg',
      'https://i0.hdslb.com/dyn/2.jpg',
    ]);
    expect(result?.publishAt).toEqual(new Date(1_792_335_725 * 1000));
    expect(result?.badges?.flat().map((badge) => badge.emoji)).toEqual([
      '🖼️',
      '👍',
      '💬',
      '🔁',
    ]);
    // 纯图文动态没有可下载的原视频
    expect(result?.strawberry).toBeUndefined();
  });

  it('sends the Cookie credentials required by the dynamic API', async () => {
    const fetch = mockFetchRoutes([['/opus/detail', opusPayload]]);
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    await getRepostHandler()({
      ...request,
      source: 'https://www.bilibili.com/opus/1260561412356308994',
    });

    const headers = fetch.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.cookie).toBe(
      'bili_ticket=TICKET; buvid3=BUVID3; buvid4=BUVID4'
    );
  });

  it('falls back to the generic dynamic API when opus returns no item', async () => {
    const fetch = mockFetchRoutes([
      ['/opus/detail', { code: 0, message: '0', ttl: 1, data: {} }],
      ['/desktop/v1/detail', dynamicAvPayload],
    ]);
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    const result = await getRepostHandler()({
      ...request,
      source: 'https://www.bilibili.com/opus/1260375384483954712',
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result?.postId).toBe('1260375384483954712');
    expect(result?.extra).toMatchObject({ type: 'opus', bvid: 'BV1HhnM62ER1' });
  });

  it('surfaces upstream dynamic errors', async () => {
    mockFetchRoutes([['/opus/detail', { code: -404, message: '动态不存在' }]]);
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    await expect(
      getRepostHandler()({
        ...request,
        source: 'https://www.bilibili.com/opus/1',
      })
    ).rejects.toThrow('动态不存在');
  });
});

describe('dynamic · t', () => {
  it('maps a video dynamic to a card and offers the raw video process', async () => {
    const fetch = mockFetchRoutes([['/desktop/v1/detail', dynamicAvPayload]]);
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    const result = await getRepostHandler()({
      ...request,
      source: 'https://t.bilibili.com/1260375384483954712',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/x/polymer/web-dynamic/desktop/v1/detail'),
      expect.any(Object)
    );
    expect(result).toMatchObject({
      method: 'post',
      postId: '1260375384483954712',
      title: '动态视频｜RTX Spark 笔记本',
      content: '电脑算是被重新发明了吗？',
      cover: 'https://i1.hdslb.com/archive.jpg',
      author: { userId: '946974', nickname: '影视飓风' },
      strawberry: { emoji: '🎞', feature: '原始视频' },
      extra: {
        type: 't',
        dynamicId: '1260375384483954712',
        bvid: 'BV1HhnM62ER1',
        aid: 117459487103569,
      },
    });
    expect(result?.badges?.[0]).toEqual([
      { emoji: '⏱️', name: '时长 07:22' },
      { emoji: '👀', name: '播放 107.1万' },
    ]);
  });

  it('maps a forward dynamic, keeping the origin as a child card', async () => {
    mockFetchRoutes([['/desktop/v1/detail', dynamicForwardPayload]]);
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    const result = await getRepostHandler()({
      ...request,
      source: 'https://t.bilibili.com/1260730964793884787',
    });

    expect(result).toMatchObject({
      postId: '1260730964793884787',
      content: '恭喜中奖，已私信通知。',
      author: { userId: '1937308559' },
    });
    // 转发动态自身没有图片，图片挂在源动态上
    expect(result?.images).toBeUndefined();
    expect(result?.child).toMatchObject({
      method: 'post',
      postId: '1259714346010804242',
      content: '随机抽取了一些大闸蟹。',
      images: [
        'https://i0.hdslb.com/dyn/a.png',
        'https://i0.hdslb.com/dyn/b.png',
      ],
    });
    expect(result?.strawberry).toBeUndefined();
  });

  it('rejects a t link without a dynamic id', async () => {
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    await expect(
      getRepostHandler()({ ...request, source: 'https://t.bilibili.com/' })
    ).rejects.toThrow();
  });
});

describe('dynamic · process', () => {
  it('resolves the missing cid by bvid before fetching the play url', async () => {
    const playUrlPayload = {
      code: 0,
      message: '0',
      ttl: 1,
      data: { durl: [{ url: 'https://upos.bilivideo.com/video.mp4' }] },
    };
    const fetch = mockFetchRoutes([
      ['/x/web-interface/wbi/view', videoPayload],
      ['/x/player/playurl', playUrlPayload],
    ]);
    const { ctx, getProcessHandler } = createMockContext();
    await adapter.initState(ctx);

    const result = await getProcessHandler()({
      ...request,
      method: 'strawberry',
      repostMethod: 'post',
      source: '1260375384483954712',
      // 动态内嵌视频只带 bvid，没有 cid
      extra: { type: 't', dynamicId: '1260375384483954712', bvid: 'BV1xx411c7mD' },
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('cid=123'),
      expect.any(Object)
    );
    expect(result?.medias).toEqual([
      { type: 'video', url: 'https://upos.bilivideo.com/video.mp4' },
    ]);
  });

  it('skips the extra lookup when the cid is already known', async () => {
    const playUrlPayload = {
      code: 0,
      message: '0',
      ttl: 1,
      data: { durl: [{ url: 'https://upos.bilivideo.com/video.mp4' }] },
    };
    const fetch = mockFetchRoutes([['/x/player/playurl', playUrlPayload]]);
    const { ctx, getProcessHandler } = createMockContext();
    await adapter.initState(ctx);

    await getProcessHandler()({
      ...request,
      method: 'strawberry',
      repostMethod: 'post',
      source: 'BV1xx411c7mD',
      extra: { type: 'video', bvid: 'BV1xx411c7mD', aid: 170001, cid: 123 },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
