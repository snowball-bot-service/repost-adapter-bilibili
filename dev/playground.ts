import adapter from '../src';
import { MockAdapterHost } from './harness';
import { bilibiliFetchVideoDetailV2 } from '../src/utils/justone-api';

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

  // const result = await bilibiliFetchVideoDetailV2("", "BV1xx411c7mD");
  // console.log(result);

}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
