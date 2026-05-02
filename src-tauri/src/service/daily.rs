// Daily service - Business logic for daily recommendations
// Converts database entities to frontend format

use crate::dao::{DbConnection};
use crate::dao::daily::*;
use crate::models::{DailyRecommendationListResponse, DailyRecommendationItem, DailyRecommendationDetail, FrontendDailyListResponse, FrontendDailyRecommendationItem, FrontendDailyRecommendationDetail, FrontendArticle};

/// Convert database DailyRecommendationItem to frontend format
fn item_to_frontend(item: DailyRecommendationItem) -> FrontendDailyRecommendationItem {
    FrontendDailyRecommendationItem {
        id: item.id.to_string(),
        date: item.date,
        article_count: item.article_count,
    }
}

/// Convert database DailyRecommendationDetail to frontend format
fn detail_to_frontend(detail: DailyRecommendationDetail) -> FrontendDailyRecommendationDetail {
    FrontendDailyRecommendationDetail {
        id: detail.id.to_string(),
        date: detail.date.clone(),
        article_count: detail.article_count,
        articles: detail.articles.into_iter().map(|p| p.into()).collect(),
        created_at: detail.created_at.unwrap_or_else(|| format!("{}T00:00:00", detail.date)),
    }
}

/// Get daily recommendations list - returns frontend format
pub fn get_daily_list(conn: &DbConnection, page: i32, page_size: i32, month: Option<&str>) -> Result<FrontendDailyListResponse, String> {
    let response = get_daily_recommendations(conn, page, page_size, month)?;

    Ok(FrontendDailyListResponse {
        items: response.items.into_iter().map(item_to_frontend).collect(),
        total: response.total,
        page: response.page,
        page_size: response.page_size,
    })
}

/// Get daily recommendation detail - returns frontend format
pub fn get_daily_detail(conn: &DbConnection, date: &str) -> Result<FrontendDailyRecommendationDetail, String> {
    let detail = get_daily_recommendation_by_date(conn, date)?;
    Ok(detail_to_frontend(detail))
}

/// Get recent daily recommendations - returns frontend format
pub fn get_recent_daily(conn: &DbConnection, limit: i32) -> Result<Vec<FrontendDailyRecommendationItem>, String> {
    let items = get_recent_recommendations(conn, limit)?;
    Ok(items.into_iter().map(item_to_frontend).collect())
}