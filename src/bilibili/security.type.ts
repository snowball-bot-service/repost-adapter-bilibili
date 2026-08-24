export interface BiliTicketResponse {
  code: number;
  message: string;
  data: {
    ticket: string;
    ttl: number;
  }
}
