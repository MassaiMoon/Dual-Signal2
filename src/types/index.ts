export type SimulateEventBody = {
  badgeId:   string;
  track:     'xSignal' | 'telegram' | 'governance' | 'holderStaking';
  contentId: string;
  secret:    string;
  // Optional: raw progress value to set directly (overrides +1 increment)
  progress?: number;
};

export type BadgeResponse = {
  id:             string;
  dualObjectId:   string;
  signalScore:    number;
  tier:           string;
  xSignalLevel:   number;
  telegramLevel:  number;
  governanceLevel:number;
  holderLevel:    number;
  isOG:           boolean;
  walletAddress:  string;
  memberSince:    string;
};

export type ApiError = {
  error: string;
};
