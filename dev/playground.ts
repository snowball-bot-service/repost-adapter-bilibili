import adapter from '../src';
import { MockAdapterHost } from './harness';
import type { RepostExtraParams } from '../src/type';

/**
 * 本地 harness 调试入口。
 *
 * 用法：
 *   pnpm dev:play                 # 跑默认用例（动态）
 *   pnpm dev:play <url> [<url>]   # 跑指定链接
 */
const DEFAULT_URLS = [
  // 动态内带转发（源动态含图片 / 视频）
  'https://b23.tv/3bYujE4',
  // 图文动态（opus，含图片）
  'https://b23.tv/eFIda2Q',
];

async function main() {
  const host = new MockAdapterHost();
  await host.register(adapter);

  const testUrls = process.argv.slice(2).length
    ? process.argv.slice(2)
    : DEFAULT_URLS;

  for (const url of testUrls) {
    try {
      const result = await host.emitRepost(url);
      const extra = result?.extra as RepostExtraParams | undefined;

      // 内嵌视频的动态：顺带验证 🍓 原始视频进程
      if (result?.strawberry && extra?.bvid) {
        await host.emitProcess('strawberry', extra.bvid, {
          repostMethod: 'post',
          extra,
        });
      }
    } catch (err) {
      console.error('✗ Failed:', err);
    }
  }

  await host.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
