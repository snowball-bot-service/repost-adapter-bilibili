# repost-adapter-bilibili

Snowball Bot v3 的哔哩哔哩视频转发适配器。

支持以下链接：

- `https://www.bilibili.com/video/BV...`
- `https://www.bilibili.com/video/av...`
- `https://b23.tv/...` 短链

转发卡片会显示视频标题、简介、封面、UP 主、发布时间、播放/点赞/投币/收藏数据、时长及分区。首版不会下载或转发视频文件。

## 开发

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm lint
```

公开详情接口无需 API Key。可在 `dev/playground.ts` 中替换测试视频链接后运行 `pnpm dev:play`。
