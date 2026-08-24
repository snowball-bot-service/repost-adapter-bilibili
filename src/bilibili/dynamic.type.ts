/** B 站动态接口最小公共模型，供后续动态转发功能复用。 */
export interface BilibiliDynamicDetailPayload {
  code: number;
  message: string;
  ttl: number;
  data?: { item: BilibiliDynamicItem };
}

export interface BilibiliDynamicItem {
  id_str: string;
  type: string | number;
  modules: BilibiliDynamicModule[] | BilibiliDynamicModule;
}

export interface BilibiliDynamicModule {
  module_type?: string;
  module_author?: { mid: number; name: string; face: string; pub_ts: number };
  module_dynamic?: { desc?: { text: string } };
}
