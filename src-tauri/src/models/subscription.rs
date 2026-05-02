// Subscription models

use serde::{Deserialize, Serialize};

/// Subscribed author entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscribedAuthor {
    pub id: i64,
    pub author_name: String,
    pub created_at: Option<String>,
}

/// Subscribed category entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscribedCategory {
    pub id: i64,
    pub category: String,
    pub created_at: Option<String>,
}

/// Subscribed keyword entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscribedKeyword {
    pub id: i64,
    pub keyword: String,
    pub created_at: Option<String>,
}

/// All subscriptions response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscriptions {
    pub authors: Vec<SubscribedAuthor>,
    pub categories: Vec<SubscribedCategory>,
    pub keywords: Vec<SubscribedKeyword>,
}