export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface GoogleSearchConsoleMetrics {
  impressions: number | null;
  clicks: number | null;
  keywords: Array<{
    keyword: string;
    position: number | null;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
  }>;
  impressionsHistory: Array<{ date: string; value: number }>;
  clicksHistory: Array<{ date: string; value: number }>;
  positionHistory: Array<{ date: string; value: number }>;
}

export interface SearchConsoleSite {
  siteUrl: string;
  permissionLevel: string;
}
