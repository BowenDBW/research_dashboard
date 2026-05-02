// Subscriptions service - Business logic for subscriptions
// Converts database entities to frontend format

use crate::dao::{DbConnection};
use crate::dao::subscriptions::*;
use crate::models::{Subscriptions, SubscribedAuthor, SubscribedCategory, SubscribedKeyword, FrontendSubscriptions, FrontendSubscribedAuthor, FrontendSubscribedCategory, FrontendSubscribedKeyword};

/// Convert database SubscribedAuthor to frontend format
impl From<SubscribedAuthor> for FrontendSubscribedAuthor {
    fn from(author: SubscribedAuthor) -> Self {
        FrontendSubscribedAuthor {
            id: author.id.to_string(),
            author_name: author.author_name,
            created_at: author.created_at,
        }
    }
}

/// Convert database SubscribedCategory to frontend format
impl From<SubscribedCategory> for FrontendSubscribedCategory {
    fn from(cat: SubscribedCategory) -> Self {
        FrontendSubscribedCategory {
            id: cat.id.to_string(),
            category: cat.category,
            created_at: cat.created_at,
        }
    }
}

/// Convert database SubscribedKeyword to frontend format
impl From<SubscribedKeyword> for FrontendSubscribedKeyword {
    fn from(kw: SubscribedKeyword) -> Self {
        FrontendSubscribedKeyword {
            id: kw.id.to_string(),
            keyword: kw.keyword,
            created_at: kw.created_at,
        }
    }
}

/// Get all subscriptions - returns frontend format
pub fn get_all(conn: &DbConnection) -> Result<FrontendSubscriptions, String> {
    let subs = get_all_subscriptions(conn)?;

    Ok(FrontendSubscriptions {
        authors: subs.authors.into_iter().map(|a| a.into()).collect(),
        categories: subs.categories.into_iter().map(|c| c.into()).collect(),
        keywords: subs.keywords.into_iter().map(|k| k.into()).collect(),
    })
}

/// Add author subscription - returns frontend format
pub fn add_author(conn: &DbConnection, author_name: &str) -> Result<FrontendSubscribedAuthor, String> {
    let author = add_subscribed_author(conn, author_name)?;
    Ok(author.into())
}

/// Remove author subscription
pub fn remove_author(conn: &DbConnection, id: i64) -> Result<(), String> {
    remove_subscribed_author(conn, id)
}

/// Add category subscription - returns frontend format
pub fn add_category(conn: &DbConnection, category: &str) -> Result<FrontendSubscribedCategory, String> {
    let cat = add_subscribed_category(conn, category)?;
    Ok(cat.into())
}

/// Remove category subscription
pub fn remove_category(conn: &DbConnection, id: i64) -> Result<(), String> {
    remove_subscribed_category(conn, id)
}

/// Add keyword subscription - returns frontend format
pub fn add_keyword(conn: &DbConnection, keyword: &str) -> Result<FrontendSubscribedKeyword, String> {
    let kw = add_subscribed_keyword(conn, keyword)?;
    Ok(kw.into())
}

/// Remove keyword subscription
pub fn remove_keyword(conn: &DbConnection, id: i64) -> Result<(), String> {
    remove_subscribed_keyword(conn, id)
}