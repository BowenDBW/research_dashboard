// Venues service - Business logic for venue operations

use crate::dao::{DbConnection};
use crate::dao::venues::*;
use crate::models::{Venue, VenueSearchResult};

/// Search venues
pub fn search_venues(conn: &DbConnection, name: &str, limit: i32) -> Result<Vec<VenueSearchResult>, String> {
    search_venues_by_name(conn, name, limit)
}

/// Search publishers
pub fn search_publishers_list(conn: &DbConnection, query: &str, limit: i32) -> Result<Vec<String>, String> {
    search_publishers(conn, query, limit)
}

/// Create venue with full info
pub fn create_venue(conn: &DbConnection, name: &str, abbreviation: Option<&str>, venue_type: Option<&str>, issn: Option<&str>, publisher: Option<&str>) -> Result<Venue, String> {
    create_venue_full(conn, name, abbreviation, venue_type, issn, publisher)
}