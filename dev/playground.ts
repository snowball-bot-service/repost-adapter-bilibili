import adapter from '../src';
import { MockAdapterHost } from './harness';

async function main() {
  const host = new MockAdapterHost();
  await host.register(adapter);

  const testUrls = ['https://www.bilibili.com/video/BV1xx411c7mD'];
  for (const url of testUrls) {
    try {
      await host.emitRepost(url);
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
