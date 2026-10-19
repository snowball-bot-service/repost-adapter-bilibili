export interface BiliTicketResponse {
  code: number;
  message: string;
  data: {
    ticket: string;
    ttl: number;
  }
}

/**
 * `/x/frontend/finger/spi` 响应：Web 端设备指纹 (buvid)。
 *
 * 动态接口 (`web-dynamic/*`) 必须携带 `buvid3` Cookie，否则上游返回 -352 风控。
 */
export interface BiliBuvidResponse {
  code: number;
  message: string;
  data: {
    b_3: string;
    b_4: string;
  }
}

/** 适配器访问 B 站 Web 接口所需的凭据集合 */
export interface BilibiliCredentials {
  ticket: string;
  buvid3: string;
  buvid4: string;
}
