export type MediaDetail = {
  title?: string;
  name?: string;
  status?: string;
  tagline?: string;
  content_ratings?: { results?: { rating?: string }[] };
  number_of_seasons?: number;
  runtime?: number;
  vote_average?: number;
  overview?: string;
  original_title?: string;
  original_name?: string;
  first_air_date?: string;
  release_date?: string;
  next_episode_to_air?: { air_date?: string };
  original_language?: string;
  networks?: { name?: string }[];
  production_companies?: { name?: string }[];
  budget?: number;
  revenue?: number;
  [key: string]: unknown;
};

export type SeasonData = {
  season_number: number;
  poster_path?: string;
  episode_count?: number;
  air_date?: string;
};

export type KeywordData = {
  id: string | number;
  name: string;
};

export type StreamData = {
  infoHash: string;
  name: string;
  title: string;
};
