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

function createMockContext(): {
  ctx: AdapterContext;
  getRepostHandler: () => RepostHandler;
  getProcessHandler: () => ProcessHandler;
} {
  let repostHandler: RepostHandler | null = null;
  let processHandler: ProcessHandler | null = null;
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

const request = {
  code: 'test',
  requester: { userId: 'REQUESTER_USERID', nickname: 'REQUESTER_NICKNAME' },
};

afterEach(() => vi.unstubAllGlobals());

describe('adapter', () => {
  it('exposes Bilibili hosts in its manifest', () => {
    expect(adapter.manifest.name).toBe('repost-adapter-bilibili');
    expect(adapter.manifest.whitelistHosts).toEqual(['bilibili.com', 'b23.tv']);
  });

  it('maps a BV video to a standard repost card', async () => {
    const fetch = mockFetch(
      new Response(JSON.stringify(videoPayload), { status: 200 })
    );
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    const result = await getRepostHandler()({
      ...request,
      source: 'https://www.bilibili.com/video/BV1xx411c7mD?p=2',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('bvid=BV1xx411c7mD'),
      expect.any(Object)
    );
    expect(result).toMatchObject({
      method: 'post',
      postId: 'BV1xx411c7mD',
      title: '测试视频',
      content: '视频简介',
      cover: 'https://i0.hdslb.com/cover.jpg',
      author: { userId: '42', nickname: '测试 UP' },
      extra: { bvid: 'BV1xx411c7mD', aid: 170001, cid: 123 },
    });
    expect(result?.badges?.flat().map((badge) => badge.emoji)).toEqual(
      expect.arrayContaining(['👀', '👍', '🪙', '⭐', '⏱️', '🏷️'])
    );
  });

  it('requests video info with aid for an av link', async () => {
    const fetch = mockFetch(
      new Response(JSON.stringify(videoPayload), { status: 200 })
    );
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    await getRepostHandler()({
      ...request,
      source: 'https://bilibili.com/video/av170001',
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('aid=170001'),
      expect.any(Object)
    );
  });

  it('follows b23 redirects before fetching video info', async () => {
    const fetch = mockFetch({
      ok: true,
      url: 'https://www.bilibili.com/video/BV1xx411c7mD',
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      url: 'https://www.bilibili.com/video/BV1xx411c7mD',
    });
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify(videoPayload), { status: 200 })
    );
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);

    const result = await getRepostHandler()({
      ...request,
      source: 'https://b23.tv/abc',
    });
    expect(result?.postId).toBe('BV1xx411c7mD');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects non-video links and Bilibili business errors', async () => {
    const { ctx, getRepostHandler } = createMockContext();
    await adapter.initState(ctx);
    await expect(
      getRepostHandler()({
        ...request,
        source: 'https://www.bilibili.com/opus/1',
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

  it('registers and rejects unsupported processing requests', async () => {
    const { ctx, getProcessHandler } = createMockContext();
    await adapter.initState(ctx);
    await expect(
      getProcessHandler()({
        ...request,
        method: 'strawberry',
        repostMethod: 'post',
        source: 'BV1xx411c7mD',
      })
    ).rejects.toThrow();
  });
});
