// Venue CRUD operations
// Handles venue (journal/conference) queries

use crate::dao::{DbConnection};
use crate::models::*;
use rusqlite::{params, Row};

/// Convert row to Venue
fn venue_from_row(row: &Row) -> Result<Venue, rusqlite::Error> {
    Ok(Venue {
        venue_id: row.get(0)?,
        name: row.get(1)?,
        abbreviation: row.get(2)?,
        issn: row.get(3)?,
        eissn: row.get(4)?,
        venue_type: row.get(5)?,
        publisher: row.get(6)?,
        url: row.get(7)?,
    })
}

/// Convert row to VenueRanking
fn ranking_from_row(row: &Row) -> Result<VenueRanking, rusqlite::Error> {
    Ok(VenueRanking {
        id: row.get(0)?,
        venue_id: row.get(1)?,
        ranking_source: row.get(2)?,
        ranking_category: row.get(3)?,
        ranking_year: row.get(4)?,
        category_detail: row.get(5)?,
    })
}

/// Get venue by ID (返回单条，用于联表查询)
pub fn get_venue_by_id(conn: &DbConnection, venue_id: i64) -> Result<Venue, String> {
    let sql = "SELECT venue_id, name, abbreviation, issn, eissn, venue_type, publisher, url
               FROM venues WHERE venue_id = ?";

    conn.query_row(sql, params![venue_id], venue_from_row)
        .map_err(|e| format!("查询刊会失败: {}", e))
}

/// Get venue by ISSN (返回单条，用于精确匹配)
pub fn get_venue_by_issn(conn: &DbConnection, issn: &str) -> Result<Option<Venue>, String> {
    let sql = "SELECT venue_id, name, abbreviation, issn, eissn, venue_type, publisher, url
               FROM venues WHERE issn = ? OR eissn = ? LIMIT 1";

    let result = conn.query_row(sql, params![issn, issn], venue_from_row);

    match result {
        Ok(venue) => Ok(Some(venue)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("查询刊会失败: {}", e)),
    }
}

/// Search venues by name (返回多条，用于用户查询匹配)
/// 优先匹配简称，简称匹配结果排在前面
pub fn search_venues_by_name(conn: &DbConnection, name: &str, limit: i32) -> Result<Vec<VenueSearchResult>, String> {
    let pattern = format!("%{}%", name);

    // 先查简称匹配的（优先）
    let sql_abbrev = "SELECT venue_id, name, abbreviation, issn, eissn, venue_type, publisher, url
               FROM venues
               WHERE abbreviation LIKE ?
               ORDER BY abbreviation
               LIMIT ?";

    let mut stmt_abbrev = conn.prepare(sql_abbrev)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let abbrev_venues: Vec<Venue> = stmt_abbrev.query_map(
        params![pattern, limit],
        venue_from_row
    ).map_err(|e| format!("查询刊会简称失败: {}", e))?
    .filter_map(|v| v.ok())
    .collect();

    // 再查名称匹配的（排除已通过简称匹配的）
    let abbrev_ids: Vec<i64> = abbrev_venues.iter().map(|v| v.venue_id).collect();
    let exclude_ids = if abbrev_ids.is_empty() {
        String::new()
    } else {
        format!("AND venue_id NOT IN ({})", abbrev_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(","))
    };

    let sql_name = format!(
        "SELECT venue_id, name, abbreviation, issn, eissn, venue_type, publisher, url
         FROM venues
         WHERE name LIKE ? {}
         ORDER BY name
         LIMIT {}",
        exclude_ids,
        limit - abbrev_venues.len() as i32
    );

    let mut stmt_name = conn.prepare(&sql_name)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let name_venues: Vec<Venue> = stmt_name.query_map(
        params![pattern],
        venue_from_row
    ).map_err(|e| format!("查询刊会名称失败: {}", e))?
    .filter_map(|v| v.ok())
    .collect();

    // 合并结果，简称匹配在前
    let all_venues: Vec<Venue> = abbrev_venues.into_iter().chain(name_venues.into_iter()).collect();

    // 为每个venue获取所有分区信息
    let results: Vec<VenueSearchResult> = all_venues.into_iter().map(|venue| {
        let rankings = get_venue_rankings(conn, venue.venue_id).unwrap_or_default();

        VenueSearchResult {
            venue_id: venue.venue_id,
            name: venue.name,
            abbreviation: venue.abbreviation,
            venue_type: venue.venue_type,
            issn: venue.issn,
            eissn: venue.eissn,
            publisher: venue.publisher,
            rankings,
        }
    }).collect();

    Ok(results)
}

/// Get all rankings for a venue
pub fn get_venue_rankings(conn: &DbConnection, venue_id: i64) -> Result<Vec<VenueRanking>, String> {
    let sql = "SELECT id, venue_id, ranking_source, ranking_category, ranking_year, category_detail
               FROM venue_rankings WHERE venue_id = ?";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let rankings: Vec<VenueRanking> = stmt.query_map(params![venue_id], ranking_from_row)
        .map_err(|e| format!("查询分区失败: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rankings)
}

/// Get venue with all rankings
pub fn get_venue_with_rankings(conn: &DbConnection, venue_id: i64) -> Result<VenueWithRankings, String> {
    let venue = get_venue_by_id(conn, venue_id)?;

    let sql = "SELECT id, venue_id, ranking_source, ranking_category, ranking_year, category_detail
               FROM venue_rankings WHERE venue_id = ?";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let rankings: Vec<VenueRanking> = stmt.query_map(params![venue_id], ranking_from_row)
        .map_err(|e| format!("查询分区失败: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(VenueWithRankings { venue, rankings })
}

/// Create a new venue (for papers without existing venue)
pub fn create_venue(conn: &DbConnection, name: &str, venue_type: Option<&str>) -> Result<Venue, String> {
    let sql = "INSERT INTO venues (name, venue_type) VALUES (?, ?)";

    conn.execute(sql, params![name, venue_type])
        .map_err(|e| format!("创建刊会失败: {}", e))?;

    let venue_id = conn.last_insert_rowid();

    Ok(Venue {
        venue_id,
        name: name.to_string(),
        abbreviation: None,
        issn: None,
        eissn: None,
        venue_type: venue_type.map(|s| s.to_string()),
        publisher: None,
        url: None,
    })
}

/// Create a new venue with full info (abbreviation, issn, publisher)
pub fn create_venue_full(
    conn: &DbConnection,
    name: &str,
    abbreviation: Option<&str>,
    venue_type: Option<&str>,
    issn: Option<&str>,
    publisher: Option<&str>,
) -> Result<Venue, String> {
    let sql = "INSERT INTO venues (name, abbreviation, venue_type, issn, publisher) VALUES (?, ?, ?, ?, ?)";

    conn.execute(sql, params![name, abbreviation, venue_type, issn, publisher])
        .map_err(|e| format!("创建刊会失败: {}", e))?;

    let venue_id = conn.last_insert_rowid();

    Ok(Venue {
        venue_id,
        name: name.to_string(),
        abbreviation: abbreviation.map(|s| s.to_string()),
        issn: issn.map(|s| s.to_string()),
        eissn: None,
        venue_type: venue_type.map(|s| s.to_string()),
        publisher: publisher.map(|s| s.to_string()),
        url: None,
    })
}

/// Find or create venue by name (用于paper插入时自动创建venue)
/// 查重时忽略大小写和空格
pub fn find_or_create_venue(conn: &DbConnection, venue_name: &str) -> Result<i64, String> {
    // 先精确匹配名称（忽略大小写和空格）
    // 使用 LOWER(REPLACE(name, ' ', '')) 进行匹配
    let normalized_name = venue_name.to_lowercase().replace(" ", "");
    let sql = "SELECT venue_id FROM venues WHERE LOWER(REPLACE(name, ' ', '')) = ? LIMIT 1";
    let result: Result<i64, _> = conn.query_row(sql, params![normalized_name], |row| row.get(0));

    match result {
        Ok(id) => Ok(id),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // 创建新venue
            let venue = create_venue(conn, venue_name, Some("journal"))?;
            Ok(venue.venue_id)
        }
        Err(e) => Err(format!("查询刊会失败: {}", e)),
    }
}

/// Get venue rankings by source
pub fn get_rankings_by_source(conn: &DbConnection, venue_id: i64, source: &str) -> Result<Vec<VenueRanking>, String> {
    let sql = "SELECT id, venue_id, ranking_source, ranking_category, ranking_year, category_detail
               FROM venue_rankings WHERE venue_id = ? AND ranking_source = ?";

    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let rankings: Vec<VenueRanking> = stmt.query_map(params![venue_id, source], ranking_from_row)
        .map_err(|e| format!("查询分区失败: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rankings)
}

/// Search publishers by name (用于出版社自动补全)
pub fn search_publishers(conn: &DbConnection, query: &str, limit: i32) -> Result<Vec<String>, String> {
    let sql = "SELECT DISTINCT publisher FROM venues
               WHERE publisher IS NOT NULL AND publisher != ''
               AND LOWER(publisher) LIKE LOWER(?)
               ORDER BY publisher
               LIMIT ?";

    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("准备查询语句失败: {}", e))?;

    let publishers: Vec<String> = stmt.query_map(params![pattern, limit], |row| row.get(0))
        .map_err(|e| format!("查询出版社失败: {}", e))?
        .filter_map(|p| p.ok())
        .collect();

    Ok(publishers)
}