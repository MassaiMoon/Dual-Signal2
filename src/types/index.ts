export type SimulateEventBody = {
  badgeId:   string;
  track:     'xSignal' | 'telegram' | 'discord' | 'governance';
  contentId: string;
  secret:    string;
  progress?: number;
};

export type BadgeResponse = {
  id:             string;
  dualObjectId:   string;
  signalScore:    number;
  tier:           string;
  xSignalLevel:   number;
  telegramLevel:  number;
  discordLevel:   number;
  governanceLevel:number;
  isOG:           boolean;
  walletAddress:  string;
  memberSince:    string;
};

export type ApiError = {
  error: string;
};
