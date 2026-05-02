export interface SubscribedAuthor {
  id: string;
  authorName: string;
  createdAt?: string;
}

export interface SubscribedCategory {
  id: string;
  category: string;
  createdAt?: string;
}

export interface SubscribedKeyword {
  id: string;
  keyword: string;
  createdAt?: string;
}

export interface Subscriptions {
  authors: SubscribedAuthor[];
  categories: SubscribedCategory[];
  keywords: SubscribedKeyword[];
}